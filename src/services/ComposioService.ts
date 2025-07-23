import { Composio } from '@composio/core';
import { VercelProvider } from '@composio/vercel';
import { type IAgentRuntime, Service, logger } from '@elizaos/core';
import { COMPOSIO_SERVICE_NAME, type ComposioServiceConfig, type ComposioToolResult } from '../types';

export class ComposioService extends Service {
  static serviceType = 'composio';

  private composio: Composio<any> | null = null;
  private serviceConfig: ComposioServiceConfig | null = null;
  private connectedApps: string[] = [];

  get capabilityDescription(): string {
    return 'Composio service that provides access to 250+ external tool integrations';
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('Initializing Composio service...');

    const apiKey = runtime.getSetting('COMPOSIO_API_KEY') as string;
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('COMPOSIO_API_KEY not provided - Composio functionality will be unavailable');
      this.composio = null;
      this.serviceConfig = null;
      this.connectedApps = [];
      return;
    }

    this.serviceConfig = {
      apiKey,
      userId: (runtime.getSetting('COMPOSIO_USER_ID') as string) || 'default',
    };

    try {
      this.composio = new Composio({
        apiKey: this.serviceConfig.apiKey,
        provider: new VercelProvider(),
      });

      await this.loadConnectedApps();
      logger.info(`Composio service initialized with ${this.connectedApps.length} connected apps`);
    } catch (error) {
      logger.error('Failed to initialize Composio service:', error);
      throw error;
    }
  }

  private async loadConnectedApps(): Promise<void> {
    if (!this.composio) {
      throw new Error('Composio client not initialized');
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
        logger.warn(`No active connected apps found for user ${userId}. Please connect apps in Composio dashboard.`);
        this.connectedApps = [];
        return;
      }

      // Extract toolkit slugs from connected accounts
      const toolkitSlugs = connectedApps
        .map((account) => account?.toolkit?.slug)
        .filter((slug) => slug && typeof slug === 'string');
      logger.info(`Found ${toolkitSlugs.length} connected apps: ${toolkitSlugs.join(', ')}`);

      this.connectedApps = toolkitSlugs;
    } catch (error) {
      logger.error('Failed to load connected apps:', error);
      this.connectedApps = [];
    }
  }

  getConnectedApps(): string[] {
    return this.connectedApps;
  }

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

  isInitialized(): boolean {
    return this.composio !== null;
  }

  getComposioClient(): Composio<any> | null {
    return this.composio;
  }

  getServiceConfig(): ComposioServiceConfig | null {
    return this.serviceConfig;
  }

  async stop(): Promise<void> {
    logger.info('Stopping Composio service...');
    this.composio = null;
    this.serviceConfig = null;
    this.connectedApps = [];
  }

  static async start(runtime: IAgentRuntime): Promise<ComposioService> {
    const service = new ComposioService(runtime);
    await service.initialize(runtime);
    return service;
  }

  static async stop(): Promise<void> {
    logger.info('Composio service stopped');
  }
}

// Export the service class, instance will be created by the plugin
export { COMPOSIO_SERVICE_NAME };
