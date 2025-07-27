/**
 * Environment variable helpers
 */

/**
 * Get environment variable as number with fallback
 */
export const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Get environment variable as string with fallback
 */
export const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

/**
 * Get environment variable as boolean with fallback
 */
export const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

/**
 * Composio execution mode configuration
 */
export type ComposioExecutionMode = 'parallel' | 'sequential';

/**
 * Get Composio execution mode from environment
 * Defaults to 'parallel' for backward compatibility
 */
export const getComposioExecutionMode = (): ComposioExecutionMode => {
  const mode = process.env.COMPOSIO_EXECUTION_MODE?.toLowerCase();
  if (mode === 'sequential') return 'sequential';
  return 'parallel';
};
