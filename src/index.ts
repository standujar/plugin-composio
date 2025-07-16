import type { IAgentRuntime, Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { useComposioToolsAction } from './actions';
import { ComposioService } from './services';

export const composioPlugin: Plugin = {
  name: 'plugin-composio',
  description: 'Composio plugin for elizaOS - provides access to 250+ external tool integrations',
  async init(_config: Record<string, string>, _runtime: IAgentRuntime) {
    logger.info('Composio plugin initialized');
  },
  services: [ComposioService],
  actions: [useComposioToolsAction],
  providers: [],
};

export default composioPlugin;
