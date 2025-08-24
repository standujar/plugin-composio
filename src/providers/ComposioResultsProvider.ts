import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import type { ToolExecution, ToolExecutionResult } from '../types';

export class ComposioResultsProvider implements Provider {
  name = 'COMPOSIO_RESULTS';
  description = 'Stores execution results from Composio tools to enable context-aware subsequent actions';

  // This data persists for the lifetime of the agent
  private executionsByToolkit: Map<string, ToolExecution[]> = new Map();

  // Returns recent executions for all toolkits
  async get(
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<{ text: string; data: { executionsByToolkit: Record<string, ToolExecution[]> } }> {
    const allExecutions: Record<string, ToolExecution[]> = {};
    this.executionsByToolkit.forEach((executions, toolkit) => {
      // Return the last 3 executions for each toolkit
      allExecutions[toolkit] = executions.slice(-3);
    });
    return {
      text: `Composio results for ${this.executionsByToolkit.size} toolkits`,
      data: { executionsByToolkit: allExecutions },
    };
  }

  // Stores an execution for a specific toolkit
  storeExecution(toolkit: string, useCase: string, results: ToolExecutionResult[]) {
    if (!this.executionsByToolkit.has(toolkit)) {
      this.executionsByToolkit.set(toolkit, []);
    }

    const toolkitExecutions = this.executionsByToolkit.get(toolkit);
    if (!toolkitExecutions) {
      return; // This should never happen due to the check above, but satisfies the linter
    }

    toolkitExecutions.push({
      timestamp: Date.now(),
      useCase,
      results,
    });

    // Limit to 5 executions per toolkit to avoid excessive memory usage
    if (toolkitExecutions.length > 5) {
      toolkitExecutions.shift();
    }
  }

  // Retrieves executions for a specific toolkit (only successful ones)
  getToolkitExecutions(toolkit: string): ToolExecution[] {
    const executions = this.executionsByToolkit.get(toolkit) || [];

    // Filter to only return executions with successful results
    return executions
      .map((execution) => ({
        ...execution,
        results: execution.results.filter(
          (r) =>
            r.result &&
            typeof r.result === 'object' &&
            r.result !== null &&
            ('successful' in r.result ? (r.result as any).successful === true : true),
        ),
      }))
      .filter((execution) => execution.results.length > 0);
  }

  // Clears executions for a specific toolkit (useful for testing)
  clearToolkitExecutions(toolkit: string): void {
    this.executionsByToolkit.delete(toolkit);
  }

  // Clears all executions (useful for testing)
  clearAll(): void {
    this.executionsByToolkit.clear();
  }
}

// Export a singleton instance
export const composioResultsProvider = new ComposioResultsProvider();
