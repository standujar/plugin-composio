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
      tool?: string;
      tool_slug?: string;
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

/**
 * Dependency tool information from COMPOSIO_GET_DEPENDENCY_GRAPH
 */
export interface DependencyTool {
  tool_name: string;
  description: string;
  required: boolean;
  reason: string;
}

/**
 * Response from COMPOSIO_GET_DEPENDENCY_GRAPH
 */
export interface ComposioDependencyGraphResponse {
  data: {
    tool_name: string;
    parent_tools: DependencyTool[];
  };
  successful: boolean;
  error: string | null;
  log_id?: string;
}

/**
 * Response from toolkit extraction prompt
 */
export interface ToolkitExtractionResponse {
  toolkit: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Response from toolkit category extraction prompt
 */
export interface ToolkitCategoryExtractionResponse {
  category: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Response from COMPOSIO_INITIATE_CONNECTION
 */
export interface ComposioInitiateConnectionResponse {
  data: {
    response_data: {
      connection_id: string;
      instruction: string;
      message: string;
      redirect_url: string;
      status: string;
      success: boolean;
    };
  };
  successful: boolean;
  error: string | null;
  log_id?: string;
}

/**
 * Tool execution result from previous runs
 */
export interface ToolExecution {
  timestamp: number;
  useCase: string;
  results: Array<{
    tool: string;
    result: unknown;
  }>;
}

/**
 * Tool execution result for storing in provider
 */
export interface ToolExecutionResult {
  tool: string;
  result: unknown;
}

/**
 * Response from COMPOSIO_RETRIEVE_TOOLKITS
 */
export interface ComposioRetrieveToolkitsResponse {
  data: {
    apps: string[];
  };
  successful: boolean;
  error: string | null;
  log_id?: string;
}

/**
 * Generic model response that can be either string or object with text property
 */
export type ModelResponse = string | { text: string; [key: string]: unknown };
