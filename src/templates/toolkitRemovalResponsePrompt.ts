export const toolkitRemovalResponsePrompt = ({
  toolkit,
  deletedCount,
  totalConnections,
  errorsCount,
  userMessage,
}: {
  toolkit: string;
  deletedCount: number;
  totalConnections: number;
  errorsCount: number;
  userMessage?: string;
}) => `Format a response for the user about removing a toolkit connection.

## USER CONTEXT
User's original message: "${userMessage || ''}"

**IMPORTANT**: Respond in the SAME LANGUAGE as the user's message. If the user wrote in French, respond in French. If in English, respond in English.

## REMOVAL DETAILS
- Toolkit: ${toolkit}
- Successfully deleted connections: ${deletedCount}
- Total connections found: ${totalConnections}
- Errors encountered: ${errorsCount}

## FORMATTING REQUIREMENTS

1. **Success Confirmation**: If deletedCount > 0, confirm successful disconnection
2. **Multiple Connections**: If totalConnections > 1, mention the number removed
3. **Error Handling**: If errorsCount > 0, mention briefly but stay positive
4. **Language**: Match the user's language from their original message
5. **Tone**: Friendly, reassuring, and professional
6. **Clarity**: Use natural language, avoid technical jargon

Create a natural, helpful response that makes the user feel confident about the action taken.`;