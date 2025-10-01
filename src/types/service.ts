import type { ToolExecuteResponse } from '@composio/core';

/**
 * Service name constant for Composio integration
 */
export const COMPOSIO_SERVICE_NAME = 'composio';

/**
 * Configuration for Composio service initialization
 */
export interface ComposioServiceConfig {
  /**
   * Composio API key for authentication
   */
  apiKey: string;
  /**
   * User ID for Composio operations (required)
   * @default 'default'
   */
  userId: string;
  /**
   * Whether multi-user mode is enabled
   * @default false
   */
  multiUserMode?: boolean;
}

/**
 * Result of a Composio tool execution
 * Using the official Composio ToolExecuteResponse type
 */
export type ComposioToolResult = ToolExecuteResponse;
