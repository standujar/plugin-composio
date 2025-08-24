import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import { type IAgentRuntime, Service, logger } from '@elizaos/core';
import { COMPOSIO_DEFAULTS } from '../config/defaults';
import {
  COMPOSIO_SERVICE_NAME,
  type ComposioDependencyGraphResponse,
  type ComposioRetrieveToolkitsResponse,
  type ComposioServiceConfig,
  type ComposioToolResult,
} from '../types';

/**
 * Service class for Composio integration
 * Manages connection to Composio API and provides tool execution capabilities
 */
export class ComposioService extends Service {
  static serviceType = 'composio';

  private composio: Composio<any> | null = null;
  private serviceConfig: ComposioServiceConfig | null = null;

  /**
   * Service capability description
   */
  get capabilityDescription(): string {
    return 'Composio service that provides access to 250+ external tool integrations';
  }

  /**
   * Initialize the Composio service
   * @param runtime - ElizaOS agent runtime instance
   */
  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('Initializing Composio service...');

    const apiKey = runtime.getSetting('COMPOSIO_API_KEY') as string;
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('COMPOSIO_API_KEY not provided - Composio functionality will be unavailable');
      this.composio = null;
      this.serviceConfig = null;
      return;
    }

    // Check first in runtime settings, then fallback to env/default
    const multiUserModeSetting = runtime.getSetting('COMPOSIO_MULTI_USER_MODE');
    const multiUserMode = multiUserModeSetting ?? COMPOSIO_DEFAULTS.MULTI_USER_MODE;
    const globalUserId = (runtime.getSetting('COMPOSIO_USER_ID') as string) || 'default';

    this.serviceConfig = {
      apiKey,
      userId: globalUserId,
      multiUserMode,
    };

    try {
      this.composio = new Composio({
        apiKey: this.serviceConfig.apiKey,
        provider: new VercelProvider() as any,
      });

      logger.info(`Composio service initialized successfully (multi-user mode: ${multiUserMode})`);
    } catch (error) {
      logger.error('Failed to initialize Composio service:', error);
      throw error;
    }
  }

  /**
   * Get connected apps for a user
   * @param userId - Optional user ID (used in multi-user mode)
   * @returns Array of connected app names (toolkit slugs)
   */
  async getConnectedApps(userId?: string): Promise<string[]> {
    if (!this.composio) {
      return [];
    }

    try {
      const effectiveUserId = this.getEffectiveUserId(userId);

      // Get user's connected apps (only ACTIVE ones)
      const connectedAppsResponse = await this.composio.connectedAccounts.list({
        userIds: [effectiveUserId],
        statuses: ['ACTIVE'],
      });

      // Extract connected accounts from response
      const connectedApps = connectedAppsResponse?.items || [];

      if (!connectedApps || connectedApps.length === 0) {
        logger.debug(`No active connected apps found for user ${effectiveUserId}`);
        return [];
      }

      // Extract toolkit slugs from connected accounts
      const toolkitSlugs = connectedApps
        .map((account) => account?.toolkit?.slug)
        .filter((slug): slug is string => slug !== null && slug !== undefined && typeof slug === 'string');

      logger.debug(
        `Found ${toolkitSlugs.length} connected apps for user ${effectiveUserId}: ${toolkitSlugs.join(', ')}`,
      );
      return toolkitSlugs;
    } catch (error) {
      logger.error('Failed to load connected apps:', error);
      return [];
    }
  }

  /**
   * Execute a Composio tool
   * @param toolName - Name of the tool to execute
   * @param parameters - Parameters for the tool execution
   * @param userId - Optional user ID for the execution
   * @returns Tool execution result
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    userId?: string,
  ): Promise<ComposioToolResult> {
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const result = await this.composio.tools.execute(toolName, {
        userId: this.getEffectiveUserId(userId),
        arguments: parameters,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error(`Failed to execute tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if the service is initialized
   * @returns True if service is initialized with a valid client
   */
  isInitialized(): boolean {
    return this.composio !== null;
  }

  /**
   * Get the Composio client instance
   * @returns Composio client instance or null if not initialized
   */
  getComposioClient(): Composio<any> | null {
    return this.composio;
  }

  /**
   * Get the service configuration
   * @returns Service configuration or null if not initialized
   */
  getServiceConfig(): ComposioServiceConfig | null {
    return this.serviceConfig;
  }

  /**
   * Get the effective user ID based on mode and provided userId
   * @param userId - Optional user ID from message
   * @returns Effective user ID to use for API calls
   */
  private getEffectiveUserId(userId?: string): string {
    if (!this.serviceConfig) {
      return 'default';
    }

    // In single user mode, always use the configured userId
    if (!this.serviceConfig.multiUserMode) {
      return this.serviceConfig.userId;
    }

    // In multi-user mode, use provided userId or fall back to configured one
    return userId || this.serviceConfig.userId;
  }

  /**
   * Check if multi-user mode is enabled
   * @returns True if multi-user mode is enabled
   */
  isMultiUserMode(): boolean {
    return this.serviceConfig?.multiUserMode ?? false;
  }

  /**
   * Check if a toolkit is already connected for a user
   * @param toolkitSlug - The toolkit slug to check
   * @param userId - Optional user ID (used in multi-user mode)
   * @returns True if the toolkit is already connected
   */
  async isToolkitConnected(toolkitSlug: string, userId?: string): Promise<boolean> {
    const connectedApps = await this.getConnectedApps(userId);
    return connectedApps.includes(toolkitSlug.toLowerCase());
  }

  /**
   * Get dependency graph for a tool with retry logic for 500 errors
   * @param toolSlug - The tool slug to get dependencies for
   * @param userId - Optional user ID
   * @returns Dependency graph with parent tools and their requirements
   */
  async getToolDependencyGraph(
    toolSlug: string,
    userId?: string,
  ): Promise<{
    tool_name: string;
    parent_tools: Array<{ tool_name: string; description: string; required: boolean; reason: string }>;
  } | null> {
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    const effectiveUserId = this.getEffectiveUserId(userId);
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = (await this.composio.tools.execute('COMPOSIO_GET_DEPENDENCY_GRAPH', {
          userId: effectiveUserId,
          arguments: {
            tool_name: toolSlug,
          },
        })) as ComposioDependencyGraphResponse;

        if (!result?.successful) {
          logger.error(`Failed to get dependency graph for ${toolSlug} (attempt ${attempt}):`, result?.error);

          // If it's a server error and we have retries left, continue to next attempt
          if (result?.error?.includes('500') && attempt < maxRetries) {
            logger.info(`Retrying dependency graph fetch for ${toolSlug} (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            continue;
          }

          return null;
        }

        // Success - return the data
        logger.debug(`Successfully got dependency graph for ${toolSlug} on attempt ${attempt}`);
        return result.data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting dependency graph for ${toolSlug} (attempt ${attempt}):`, errorMessage);

        // If it's a server error and we have retries left, continue to next attempt
        if (errorMessage.includes('500') && attempt < maxRetries) {
          logger.info(
            `Retrying dependency graph fetch for ${toolSlug} due to server error (attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }

        // If it's not a 500 error or no more retries, return null
        return null;
      }
    }

    // This should never be reached, but just in case
    return null;
  }

  /**
   * Retrieve toolkits by category using COMPOSIO_RETRIEVE_TOOLKITS
   * @param category - Category of apps to retrieve (e.g., "send email")
   * @param userId - Optional user ID
   * @returns List of available toolkit slugs for the category
   */
  async getToolkitsByCategory(category: string, userId?: string): Promise<string[]> {
    if (!this.composio) {
      throw new Error('Composio client not initialized');
    }

    try {
      const effectiveUserId = this.getEffectiveUserId(userId);
      
      const result = (await this.composio.tools.execute('COMPOSIO_RETRIEVE_TOOLKITS', {
        userId: effectiveUserId,
        arguments: {
          category,
        },
      })) as ComposioRetrieveToolkitsResponse;

      if (!result?.successful) {
        logger.error(`Failed to retrieve toolkits for category "${category}":`, result?.error);
        return [];
      }

      const apps = result.data?.apps || [];
      logger.debug(`Found ${apps.length} toolkits for category "${category}": ${apps.join(', ')}`);
      return apps;
    } catch (error) {
      logger.error(`Error retrieving toolkits for category "${category}":`, error);
      return [];
    }
  }

  /**
   * Stop the Composio service and clean up resources
   */
  async stop(): Promise<void> {
    logger.info('Stopping Composio service...');
    this.composio = null;
    this.serviceConfig = null;
  }

  /**
   * Static stop method for service cleanup
   */
  static async stop(): Promise<void> {
    logger.info('Composio service stopped');
  }

  /**
   * Factory method to create and initialize a Composio service
   * @param runtime - ElizaOS agent runtime instance
   * @returns Initialized Composio service instance
   */
  static async start(runtime: IAgentRuntime): Promise<ComposioService> {
    const service = new ComposioService(runtime);
    await service.initialize(runtime);
    return service;
  }
}

// Export the service class, instance will be created by the plugin
export { COMPOSIO_SERVICE_NAME };
