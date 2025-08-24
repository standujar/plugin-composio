export const toolkitBrowseResponsePrompt = ({
  category,
  toolkits,
  userMessage,
}: {
  category: string;
  toolkits: string[];
  userMessage?: string;
}) => `Format a response for the user showing available toolkits for a category.

## USER CONTEXT
User's original message: "${userMessage || ''}"

**IMPORTANT**: Respond in the SAME LANGUAGE as the user's message.

## BROWSE RESULTS
- Category: ${category}
- Available toolkits: ${toolkits.join(', ')}
- Count: ${toolkits.length} apps found

## FORMATTING REQUIREMENTS

1. **Clear Category**: Mention what type of apps these are for
2. **List Apps**: Show the available toolkit names in a readable format
3. **Connection Instructions**: Explain how to connect any of these apps
4. **Language**: Match the user's language from their original message
5. **Tone**: Helpful and encouraging
6. **Format**: Use natural language, group similar apps if many

Create a helpful response that shows the available options and guides the user on next steps.`;