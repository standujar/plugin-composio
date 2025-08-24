/**
 * Generates a prompt to extract toolkit and use case information from user request
 * @param connectedApps - List of connected app names
 * @param conversationContext - Previous conversation context
 * @param userRequest - The user's current request
 * @returns Formatted prompt string for toolkit extraction
 */
export const toolkitExtractionPrompt = ({
  connectedApps,
  conversationContext,
  userRequest,
}: {
  connectedApps: string[];
  conversationContext: string;
  userRequest: string;
}) => `Extract toolkit and use case from request.

Request: "${userRequest}"
${conversationContext ? `Context: ${conversationContext}` : ''}
Apps: ${connectedApps.join(', ')}

Rules:
- Select ONE app from the list above
- Use verb + action format
- Exclude Composio internal tools

JSON format:
{
  "toolkit": "app_name",
  "use_case": "verb + action"
}

Examples:
"Create issue in Linear" → {"toolkit": "linear", "use_case": "create issue"}
"Update my GitHub PR" → {"toolkit": "github", "use_case": "update pull request"}
"Send message to engineering channel" → {"toolkit": "slack", "use_case": "send message to channel"}

Return JSON only:`;
