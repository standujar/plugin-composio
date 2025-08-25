import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import type { ToolExecution, ToolExecutionResult } from '../types';

export class ComposioResultsProvider implements Provider {
  name = 'COMPOSIO_RESULTS';
  description = 'Stores execution results from Composio tools to enable context-aware subsequent actions';

  // This data persists for the lifetime of the agent
  // Structure: Map<entityId, Map<toolkit, ToolExecution[]>>
  private executionsByEntityAndToolkit: Map<string, Map<string, ToolExecution[]>> = new Map();

  // Returns recent executions for all toolkits for a specific entity
  async get(
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
  ): Promise<{ text: string; data: { executionsByToolkit: Record<string, ToolExecution[]> } }> {
    // Determine entity based on multi-user mode
    const multiUserMode = runtime.getSetting('COMPOSIO_MULTI_USER_MODE') === 'true';
    const entityId = multiUserMode ? message.entityId : (runtime.getSetting('COMPOSIO_DEFAULT_USER_ID') as string || 'default');
    
    const entityExecutions = this.executionsByEntityAndToolkit.get(entityId);
    
    if (!entityExecutions) {
      return {
        text: 'No Composio executions found for this entity',
        data: { executionsByToolkit: {} },
      };
    }
    
    const allExecutions: Record<string, ToolExecution[]> = {};
    entityExecutions.forEach((executions, toolkit) => {
      // Return the last 3 executions for each toolkit
      allExecutions[toolkit] = executions.slice(-3);
    });
    
    return {
      text: `Composio results for ${entityExecutions.size} toolkits`,
      data: { executionsByToolkit: allExecutions },
    };
  }

  // Stores an execution for a specific toolkit and entity
  storeExecution(entityId: string, toolkit: string, useCase: string, results: ToolExecutionResult[]) {
    // Get or create entity map
    if (!this.executionsByEntityAndToolkit.has(entityId)) {
      this.executionsByEntityAndToolkit.set(entityId, new Map());
    }
    
    const entityExecutions = this.executionsByEntityAndToolkit.get(entityId)!;
    
    // Get or create toolkit executions for this entity
    if (!entityExecutions.has(toolkit)) {
      entityExecutions.set(toolkit, []);
    }

    const toolkitExecutions = entityExecutions.get(toolkit)!;

    toolkitExecutions.push({
      timestamp: Date.now(),
      useCase,
      entityId,
      results,
    });

    // Limit to 5 executions per toolkit to avoid excessive memory usage
    if (toolkitExecutions.length > 5) {
      toolkitExecutions.shift();
    }
  }

  // Retrieves executions for a specific toolkit and entity (only successful ones)
  getToolkitExecutions(entityId: string, toolkit: string): ToolExecution[] {
    const entityExecutions = this.executionsByEntityAndToolkit.get(entityId);
    if (!entityExecutions) {
      return [];
    }
    
    const executions = entityExecutions.get(toolkit) || [];

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

  // Clears executions for a specific toolkit and entity (useful for testing)
  clearToolkitExecutions(entityId: string, toolkit: string): void {
    const entityExecutions = this.executionsByEntityAndToolkit.get(entityId);
    if (entityExecutions) {
      entityExecutions.delete(toolkit);
    }
  }

  // Clears all executions (useful for testing)
  clearAll(): void {
    this.executionsByEntityAndToolkit.clear();
  }
}

// Export a singleton instance
export const composioResultsProvider = new ComposioResultsProvider();
