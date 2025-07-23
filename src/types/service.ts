export const COMPOSIO_SERVICE_NAME = 'composio';

export interface ComposioServiceConfig {
  apiKey: string;
  userId?: string;
}

export interface ComposioToolResult {
  success: boolean;
  data?: Record<string, unknown> | string | number | boolean | null;
  error?: string;
}
