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
   * Optional user ID for Composio operations
   * @default 'default'
   */
  userId?: string;
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
