export const connectedToolkitsListResponsePrompt = ({
  connectedApps,
  userMessage,
}: {
  connectedApps: string[];
  userMessage?: string;
}) => `Format a response showing the user's connected apps.

## USER CONTEXT
User's original message: "${userMessage || ''}"

**IMPORTANT**: Respond in the SAME LANGUAGE as the user's message.

## CONNECTED APPS
- Apps: ${connectedApps.join(', ')}
- Count: ${connectedApps.length} apps connected

## FORMATTING REQUIREMENTS

1. **Clear Summary**: Show how many apps are connected
2. **List Apps**: Display the connected app names clearly
3. **App Descriptions**: Brief description of what each app is for (optional)
4. **Next Steps**: Mention they can disconnect apps or connect new ones
5. **Language**: Match the user's language from their original message
6. **Tone**: Informative and helpful
7. **Empty State**: If no apps connected, encourage connecting some

Create a natural response that clearly shows their connected integrations.`;