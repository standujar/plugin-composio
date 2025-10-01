/**
 * Types related to toolkit management and resolution
 */

import type { DependencyTool, VercelAIToolCollection, WorkflowPlan } from './composio';

/**
 * Response from workflow extraction prompt - Multi-toolkit format
 */
export interface WorkflowExtractionResponse {
  toolkits: Array<{
    name: string;
    use_case: string;
  }>;
  reasoning: string;
  use_case: string;
}

/**
 * Type for an extracted toolkit
 */
export interface ExtractedToolkit {
  name: string;
  use_case: string;
}

/**
 * Type for a group of consecutive toolkits
 */
export interface ToolkitGroup {
  name: string;
  use_cases: string[];
}

/**
 * Type for a prepared toolkit group with tools ready
 */
export interface PreparedToolkitGroup extends ToolkitGroup {
  tools: VercelAIToolCollection;
  dependencyGraphs: Array<{
    tool_name: string;
    parent_tools: DependencyTool[];
  }>;
  workflowPlan?: WorkflowPlan | null;  // The plan for this group's execution
  searchMetadata?: {  // Metadata from search results
    reasoning?: string;
    timeInfo?: any;
  };
}

/**
 * Response from toolkit extraction prompt
 */
export interface ToolkitExtractionResponse {
  toolkit: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Response from toolkit selection after COMPOSIO_RETRIEVE_TOOLKITS
 */
export interface ToolkitSelectionResponse {
  selectedToolkit: string;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

/**
 * Response from toolkit category extraction prompt
 */
export interface ToolkitCategoryExtractionResponse {
  category: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Toolkit mapping for caching user search terms to actual toolkit names
 */
export interface ToolkitMapping {
  searchTerm: string;          // What the user requested (e.g., "google calendar", "gcal")
  resolvedToolkit: string;     // The actual toolkit name in Composio (e.g., "googlecalendar")
  category?: string;           // Category used for the search
  confidence: 'high' | 'medium' | 'low';
  lastUsed: number;           // Timestamp of last usage
  usageCount: number;         // Number of times this mapping was used
  variations?: string[];      // Other search terms that resolved to the same toolkit
}