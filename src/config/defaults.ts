/**
 * Plugin default configuration values
 * These can be overridden by environment variables
 */

import { getEnvNumber, getEnvString } from './env';

export const COMPOSIO_DEFAULTS = {
  // LLM Temperature settings
  WORKFLOW_EXTRACTION_TEMPERATURE: getEnvNumber('COMPOSIO_WORKFLOW_EXTRACTION_TEMPERATURE', 0.7),
  TOOL_EXECUTION_TEMPERATURE: getEnvNumber('COMPOSIO_TOOL_EXECUTION_TEMPERATURE', 0.3),

  // User settings
  DEFAULT_USER_ID: getEnvString('COMPOSIO_DEFAULT_USER_ID', 'default'),
} as const;
