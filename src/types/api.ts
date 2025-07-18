/**
 * API response types for Composio
 */

/**
 * Response from queryExtractionPrompt LLM call
 */
export interface WorkflowExtractionResponse {
  toolkit: string;
  use_case: string;
}

/**
 * Response from COMPOSIO_SEARCH_TOOLS
 */
export interface ComposioSearchToolsResponse {
  data: {
    reasoning: string;
    results: Array<{
      description: string;
      input_schema: Record<string, unknown>;
      order: number;
      tool: string;
      toolkit: string;
    }>;
  };
  successful: boolean;
  error: string | null;
  log_id?: string;
}

/**
 * Tool collection returned by Composio SDK for Vercel AI
 */
export type VercelAIToolCollection = Record<string, unknown>;
