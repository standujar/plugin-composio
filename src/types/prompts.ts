/**
 * Types for prompt templates and responses
 */

/**
 * User response action types
 */
export type UserResponseAction = 'connect' | 'disconnect' | 'list' | 'browse';

/**
 * Data structure for user response prompts
 */
export interface UserResponseData {
  toolkit?: string;
  toolkits?: string[];
  status?: string;
  success?: boolean;
  message?: string;
  redirectUrl?: string;
  instruction?: string;
  category?: string;
  count?: number;
}

/**
 * Parameters for user response prompt generation
 */
export interface UserResponsePromptParams {
  action: UserResponseAction;
  data: UserResponseData;
  userMessage: string;
}

/**
 * Toolkit resolution modes
 */
export type ToolkitResolutionMode = 'extract' | 'select' | 'extract_and_select';

/**
 * Parameters for toolkit resolution prompt
 */
export interface ToolkitResolutionPromptParams {
  userMessage: string;
  availableToolkits?: string[];
  mode: ToolkitResolutionMode;
}