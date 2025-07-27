import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import { type IAgentRuntime, logger, Service } from '@elizaos/core';
import { COMPOSIO_SERVICE_NAME, type ComposioServiceConfig, type ComposioToolResult } from '../types';

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

    this.serviceConfig = {
      apiKey,
      userId: (runtime.getSetting('COMPOSIO_USER_ID') as string) || 'default',
    };

    try {
      this.composio = new Composio({
        apiKey: this.serviceConfig.apiKey,
        provider: new VercelProvider() as any,
      });

      logger.info('Composio service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Composio service:', error);
      throw error;
    }
  }


  /**
   * Get connected apps for the current user
   * @returns Array of connected app names (toolkit slugs)
   */
  async getConnectedApps(): Promise<string[]> {
    if (!this.composio) {
      return [];
    }

    try {
      const userId = this.serviceConfig?.userId || 'default';
      
      // Get user's connected apps (only ACTIVE ones)
      const connectedAppsResponse = await this.composio.connectedAccounts.list({
        userIds: [userId],
        statuses: ['ACTIVE'],
      });

      // Extract connected accounts from response
      const connectedApps = connectedAppsResponse?.items || [];

      if (!connectedApps || connectedApps.length === 0) {
        logger.debug(`No active connected apps found for user ${userId}`);
        return [];
      }

      // Extract toolkit slugs from connected accounts
      const toolkitSlugs = connectedApps
        .map((account) => account?.toolkit?.slug)
        .filter((slug): slug is string => slug !== null && slug !== undefined && typeof slug === 'string');
      
      logger.debug(`Found ${toolkitSlugs.length} connected apps: ${toolkitSlugs.join(', ')}`);
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
        userId: userId || this.serviceConfig?.userId || 'default',
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
