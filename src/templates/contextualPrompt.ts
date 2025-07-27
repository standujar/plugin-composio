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
  const styleSection = agentResponseStyle ? `Style: ${agentResponseStyle}\n\n` : '';
  
  return `${styleSection}${contextSection}Task: ${userRequest}

Use the provided tools to complete the user request.
Include relevant details and links in your response.`;
};
