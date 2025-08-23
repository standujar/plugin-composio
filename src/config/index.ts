import type { IAgentRuntime } from '@elizaos/core';
import type { ComposioServiceConfig } from '../types';
import { COMPOSIO_DEFAULTS } from './defaults';

// Re-export configuration utilities
export * from './defaults';

/**
 * Extracts Composio configuration from runtime settings
 * @param runtime - ElizaOS agent runtime instance
 * @returns Composio service configuration or null if API key is missing
 */
export function getComposioConfig(runtime: IAgentRuntime): ComposioServiceConfig | null {
  const apiKey = runtime.getSetting('COMPOSIO_API_KEY') as string;

  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  return {
    apiKey,
    userId: (runtime.getSetting('COMPOSIO_USER_ID') as string) || COMPOSIO_DEFAULTS.DEFAULT_USER_ID,
  };
}
