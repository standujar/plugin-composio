/**
 * Response from model when using tools
 */
export interface ModelToolResponse {
  text?: string;
  toolResults?: Array<{
    result: unknown;
    [key: string]: unknown;
  }>;
  toolCalls?: Array<{
    toolName: string;
    args: unknown;
    [key: string]: unknown;
  }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
  [key: string]: unknown;
}

/**
 * Type guard to check if response is a ModelToolResponse
 */
export function isModelToolResponse(response: unknown): response is ModelToolResponse {
  return (
    typeof response === 'object' && 
    response !== null &&
    ('text' in response || 'toolResults' in response)
  );
}

/**
 * Extract text content from model response
 */
export function extractResponseText(response: unknown): string {
  if (typeof response === 'string') {
    return response;
  }
  
  if (isModelToolResponse(response)) {
    // If we have tool results, stringify the first one
    if (response.toolResults && response.toolResults.length > 0) {
      const result = response.toolResults[0]?.result;
      return typeof result === 'string' ? result : JSON.stringify(result);
    }
    // Otherwise return the text
    return response.text || '';
  }
  
  return '';
}