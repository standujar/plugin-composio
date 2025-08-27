/**
 * Plugin default configuration values
 * These can be overridden by environment variables
 */

function getEnvNumber(name: string, fallback: number): number {
  const value = process.env?.[name];
  if (!value) return fallback;
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? fallback : num;
}

function getEnvString(name: string, fallback: string): string {
  return process.env?.[name] || fallback;
}

function getEnvBoolean(name: string, fallback: boolean): boolean {
  const value = process.env?.[name];
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

function getEnvArray(name: string, fallback: string[]): string[] {
  const value = process.env?.[name];
  if (!value || value.trim() === '') return fallback;
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

export const COMPOSIO_DEFAULTS = {
  // LLM Temperature settings
  TOOLKIT_EXTRACTION_TEMPERATURE: getEnvNumber('COMPOSIO_TOOLKIT_EXTRACTION_TEMPERATURE', 0.7),
  TOOLKIT_CATEGORY_EXTRACTION_TEMPERATURE: getEnvNumber('COMPOSIO_TOOLKIT_CATEGORY_EXTRACTION_TEMPERATURE', 0.7),
  TOOL_EXECUTION_TEMPERATURE: getEnvNumber('COMPOSIO_TOOL_EXECUTION_TEMPERATURE', 0.5),
  TOOLKIT_CONNECTION_EXTRACTION_TEMPERATURE: getEnvNumber('COMPOSIO_TOOLKIT_CONNECTION_EXTRACTION_TEMPERATURE', 0.3),
  TOOLKIT_CONNECTION_RESPONSE_TEMPERATURE: getEnvNumber('COMPOSIO_TOOLKIT_CONNECTION_RESPONSE_TEMPERATURE', 0.7),
  TOOLKIT_REMOVAL_RESPONSE_TEMPERATURE: getEnvNumber('COMPOSIO_TOOLKIT_REMOVAL_RESPONSE_TEMPERATURE', 0.7),
  TOOLKIT_BROWSE_RESPONSE_TEMPERATURE: getEnvNumber('COMPOSIO_TOOLKIT_BROWSE_RESPONSE_TEMPERATURE', 0.7),
  CONNECTED_TOOLKITS_LIST_RESPONSE_TEMPERATURE: getEnvNumber('COMPOSIO_CONNECTED_TOOLKITS_LIST_RESPONSE_TEMPERATURE', 0.7),

  // User settings
  DEFAULT_USER_ID: getEnvString('COMPOSIO_DEFAULT_USER_ID', 'default'),
  MULTI_USER_MODE: getEnvBoolean('COMPOSIO_MULTI_USER_MODE', false),
  ALLOWED_TOOLKITS: getEnvArray('COMPOSIO_ALLOWED_TOOLKITS', []),

  // Conversation context settings
  RECENT_EXCHANGES_LIMIT: getEnvNumber('COMPOSIO_RECENT_EXCHANGES_LIMIT', 10),
  
  // Tool execution history settings
  RECENT_TOOL_SLUGS_LIMIT: getEnvNumber('COMPOSIO_RECENT_TOOL_SLUGS_LIMIT', 5),
} as const;
