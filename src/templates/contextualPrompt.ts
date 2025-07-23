export const contextualPrompt = ({
  conversationContext,
  userRequest,
}: {
  conversationContext: string;
  userRequest: string;
}) => {
  let prompt = '';

  if (conversationContext) {
    prompt = `Given this conversation:
${conversationContext}

`;
  }
  prompt += `User's request: ${userRequest}

IMPORTANT INSTRUCTIONS:
1. Execute the necessary tools to fulfill the user's request
2. After executing tools, ALWAYS provide a clear, formatted response that presents the results
3. Structure your response to be helpful and easy to read on a chat interface
4. If you retrieved data, present it in a clear format
5. Never just say "Tools executed successfully" - always explain what was done and show the results

Please execute the appropriate tools and then provide a comprehensive response with the results.`;

  return prompt;
};
