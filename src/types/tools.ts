export interface QueryWithToolkit {
  toolkit: string;
  query: string;
}

export interface QueryExtractionResponse {
  queries: QueryWithToolkit[];
}

export interface ComposioTool {
  id: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ToolExecutionContext {
  conversationContext: string;
  userRequest: string;
  connectedApps: string[];
}
