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
 */
export interface ComposioToolResult {
  /**
   * Whether the tool execution was successful
   */
  success: boolean;
  /**
   * The data returned by the tool execution
   */
  data?: Record<string, unknown> | string | number | boolean | null;
  /**
   * Error message if the execution failed
   */
  error?: string;
}
