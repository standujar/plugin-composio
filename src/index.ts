import type { IAgentRuntime, Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { useComposioToolsAction, useComposioToolsSequentialAction } from './actions';
import { getComposioExecutionMode } from './config/env';
import { ComposioService } from './services';

/**
 * Composio plugin for ElizaOS
 * Provides integration with 250+ external tools and services through Composio API
 */
export const composioPlugin: Plugin = {
  name: 'plugin-composio',
  description: 'Composio plugin for elizaOS - provides access to 250+ external tool integrations',
  /**
   * Initialize the plugin
   * @param _config - Plugin configuration
   * @param _runtime - ElizaOS agent runtime
   */
  async init(_config: Record<string, string>, _runtime: IAgentRuntime) {
    const mode = getComposioExecutionMode();
    logger.info(`Composio plugin initialized in ${mode} mode`);
  },
  services: [ComposioService],
  actions: [
    getComposioExecutionMode() === 'sequential' 
      ? useComposioToolsSequentialAction 
      : useComposioToolsAction
  ]
};

export default composioPlugin;
