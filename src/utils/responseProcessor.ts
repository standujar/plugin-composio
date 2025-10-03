import type { ToolResult } from '../types';

/**
 * Processes AI SDK v5 responses to extract tool results and handle response data
 */
export class ResponseProcessor {
  /**
   * Extracts tool results from AI SDK v5 steps response
   * @param response - The model response that may contain steps
   * @returns Array of tool results from all steps
   */
  static extractToolResultsFromSteps(response: any): any[] {
    const toolResults: ToolResult[] = [];

    // Type guard: check if response is an object with steps property
    if (response && typeof response === 'object' && response.steps && Array.isArray(response.steps)) {
      for (const step of response.steps) {
        if (step.content && Array.isArray(step.content)) {
          // Look for tool-result content in AI SDK v5 format
          for (const content of step.content) {
            if (content.type === 'tool-result' && content.output) {
              toolResults.push({
                toolCallId: content.toolCallId,
                result: content.output
              });
            }
          }
        }
      }
    }

    return toolResults;
  }

  /**
   * Filters successful tool results from Composio format
   * @param toolResults - Array of tool results to filter
   * @returns Array of successful tool results only
   */
  static filterSuccessfulResults(toolResults: any[]): any[] {
    return toolResults.filter(toolResult =>
      toolResult.result &&
      typeof toolResult.result === 'object' &&
      'successful' in toolResult.result &&
      toolResult.result.successful === true
    );
  }
}