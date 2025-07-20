/**
 * Generates a contextual prompt for tool execution
 * @param conversationContext - Previous conversation context
 * @param userRequest - The workflow use case to execute
 * @returns Formatted prompt string for the LLM
 */
export const contextualPrompt = ({
  userRequest,
  conversationContext,
  agentResponseStyle,
}: {
  userRequest: string;
  conversationContext?: string;
  agentResponseStyle?: string;
}) => {
  const contextSection = conversationContext ? `${conversationContext}\n\n` : '';
  const styleSection = agentResponseStyle ? `Agent response style: ${agentResponseStyle}\n\n` : '';
  
  return `${styleSection}${contextSection}Task to complete: ${userRequest}

IMPORTANT INSTRUCTIONS:
1. You have been provided with specific tools to complete this task
2. Execute the tools in the logical order described in the task
3. Use the exact values mentioned in the task description
4. Consider the conversation context to understand any references to previous messages if it is provided and relevant to the task
5. Include links if you find them relevant to the task
6. After executing all necessary tools, summarize what was accomplished in a way that is easy to understand and follow up on.

Execute the workflow step by step and provide a natural, conversational response with all the important details from your findings.`;
};
