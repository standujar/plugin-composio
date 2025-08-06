/**
 * Generates a contextual prompt for tool execution
 * @param conversationContext - Previous conversation context
 * @param userRequest - The workflow use case to execute
 * @param previousExecutions - Previous tool execution results
 * @returns Formatted prompt string for the LLM
 */
export const contextualPrompt = ({
  userRequest,
  conversationContext,
  agentResponseStyle,
  previousExecutions = [],
}: {
  userRequest: string;
  conversationContext?: string;
  agentResponseStyle?: string;
  previousExecutions?: Array<{
    timestamp: number;
    useCase: string;
    results: Array<{
      tool: string;
      result: any;
    }>;
  }>;
}) => {
  const contextSection = conversationContext ? `${conversationContext}\n\n` : '';
  const styleSection = agentResponseStyle ? `Style: ${agentResponseStyle}\n\n` : '';
  
  // Format previous executions for the LLM
  const executionsSection = previousExecutions.length > 0 
    ? `Recent tool executions that may contain relevant data:
${previousExecutions.map(exec => 
  `- ${exec.useCase}
   Results: ${JSON.stringify(exec.results, null, 2)}`
).join('\n\n')}

`
    : '';
  
  return `${styleSection}${contextSection}${executionsSection}Task: ${userRequest}

Use the provided tools to complete the user request.
${previousExecutions.length > 0 ? 'You can reference data from previous executions (IDs, names, etc.) when needed.' : ''}
Include relevant details and links in your response.`;
};
