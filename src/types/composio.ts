/**
 * Types specific to Composio API responses and data structures
 */

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
 * Dependency tool information from COMPOSIO_GET_DEPENDENCY_GRAPH
 */
export interface DependencyTool {
  tool_name: string;
  description: string;
  required: boolean;
  reason: string;
}

/**
 * Tool collection returned by Composio SDK for Vercel AI
 */
export type VercelAIToolCollection = Record<string, unknown>;