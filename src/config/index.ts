import type { IAgentRuntime } from '@elizaos/core';
import { COMPOSIO_DEFAULTS } from '../constants';
import type { ComposioServiceConfig } from '../types';

/**
 * Extracts Composio configuration from runtime settings
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
