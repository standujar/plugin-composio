/**
 * Types specific to Composio API responses and data structures
 */

/**
 * Response from COMPOSIO_SEARCH_TOOLS
 */
export interface ComposioSearchToolsResponse {
  data: {
    main_tool_slugs: string[];
    reasoning?: string;
    time_info?: {
      current_time: string;
      current_time_epoch_in_seconds: number;
    };
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
 * Workflow step in the plan
 */
export interface WorkflowStep {
  step_id: string;
  name: string;
  intent: string;
  tool: string;
  dependencies: string[];
  parallelizable: boolean;
}

/**
 * Workflow plan structure
 */
export interface WorkflowPlan {
  workflow_steps: WorkflowStep[];
  complexity_assessment?: {
    complexity: string;
    data_volume: string;
    time_sensitivity: string;
  };
  tool_capabilities_assessment?: Record<string, any>;
  workflow_design_considerations?: any;
  failure_handling?: any;
  output_format?: any;
  edge_case_handling?: string[];
  user_confirmation_guidance?: any;
  critical_instructions?: string;
  output_guidlines?: string;
}

/**
 * Response from COMPOSIO_CREATE_PLAN
 */
export interface ComposioCreatePlanResponse {
  data: {
    workflow_instructions: {
      plan: WorkflowPlan;
      time_info?: {
        current_date: string;
        current_time_epoch_in_seconds: number;
        message: string;
      };
    };
  };
  successful: boolean;
  error: string | null;
  log_id?: string;
}

/**
 * Tool collection returned by Composio SDK for Vercel AI
 */
export type VercelAIToolCollection = Record<string, unknown>;