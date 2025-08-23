export const connectionResponsePrompt = ({
  toolkit,
  status,
  success,
  message,
  redirectUrl,
  instruction,
  userMessage,
}: {
  toolkit: string;
  status: string;
  success: boolean;
  message?: string;
  redirectUrl?: string;
  instruction?: string;
  userMessage?: string;
}) => `Format this toolkit connection response for the user in a helpful, natural way.

## USER CONTEXT
User's original message: "${userMessage || ''}"

**IMPORTANT**: Respond in the SAME LANGUAGE as the user's message.

## CONNECTION DETAILS
- Toolkit: ${toolkit}
- Status: ${status}
- Success: ${success}
- Message: ${message || 'N/A'}
- Redirect URL: ${redirectUrl || 'N/A'}
- Instruction: ${instruction || 'N/A'}

## FORMATTING REQUIREMENTS

1. **Confirmation**: Clearly confirm that the connection was initiated
2. **Next Steps**: Provide the redirect URL as a clickable link if available
3. **Clear Instructions**: Explain what the user needs to do next
4. **Language**: Match the user's language from their original message
5. **Tone**: Be friendly, encouraging, and helpful
6. **Format**: Use natural language, not technical jargon

Create a response that's helpful and guides the user through the process naturally.`;