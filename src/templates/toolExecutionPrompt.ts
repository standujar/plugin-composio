import type { DependencyTool, ToolExecution } from '../types';

/**
 * Generates a contextual prompt for tool execution
 * @param conversationContext - Previous conversation context
 * @param userRequest - The workflow use case to execute
 * @param previousExecutions - Previous tool execution results
 * @param dependencyGraph - Tool dependency information
 * @returns Formatted prompt string for the LLM
 */
export const contextualPrompt = ({
  userRequest,
  conversationContext,
  agentResponseStyle,
  previousExecutions = [],
  dependencyGraph = [],
}: {
  userRequest: string;
  conversationContext?: string;
  agentResponseStyle?: string;
  previousExecutions?: ToolExecution[];
  dependencyGraph?: DependencyTool[];
}) => {
  const contextSection = conversationContext ? `${conversationContext}\n\n` : '';
  const styleSection = agentResponseStyle ? `Style: ${agentResponseStyle}\n\n` : '';

  // Format previous executions for the LLM
  const executionsSection =
    previousExecutions.length > 0
      ? `Recent tool executions that may contain relevant data:
${previousExecutions
  .map(
    (exec) =>
      `- ${exec.useCase}
   Results: ${JSON.stringify(exec.results, null, 2)}`,
  )
  .join('\n\n')}

`
      : '';

  // Format dependency graph for the LLM
  const dependencySection =
    dependencyGraph.length > 0
      ? `Tool Dependencies (understand the workflow):
${dependencyGraph
  .map(
    (dep) =>
      `- ${dep.tool_name}: ${dep.description}
   Reason: ${dep.reason}
   Required: ${dep.required}`,
  )
  .join('\n\n')}

`
      : '';

  return `${styleSection}${contextSection}${executionsSection}${dependencySection}Task: ${userRequest}

**WORKFLOW GUIDANCE**:
1. **Check previous executions first** - If you already have the required data (IDs, parameters), use it directly
2. **Chain tools logically**:
   - Use lookup tools to get IDs, then pass those IDs as parameters to other tools
   - If a tool needs filtering (assignee, project, etc.), get the required IDs from dependencies first
   - Connect the output of one tool to the input of another when needed
3. **Execute main action** with the gathered information
4. **Don't call redundant tools** if you already have the required data from previous executions

Use the provided tools to complete the user request efficiently.
Include relevant details and links in your response.`;
};
