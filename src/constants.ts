/**
 * Plugin constants and default values
 */

export const COMPOSIO_DEFAULTS = {
  // Query extraction settings
  MAX_QUERIES_PER_REQUEST: 4,
  QUERY_EXTRACTION_TEMPERATURE: 0.6,

  // Tool search settings
  TOOLS_PER_QUERY_LIMIT: 4,

  // Execution settings
  TOOL_EXECUTION_TEMPERATURE: 0.3,
  MAX_TOOL_STEPS: 10,

  // User settings
  DEFAULT_USER_ID: 'default',
} as const;
