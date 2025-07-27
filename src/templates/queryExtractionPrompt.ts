/**
 * Generates a prompt to extract workflow information from user request
 * @param connectedApps - List of connected app names
 * @param conversationContext - Previous conversation context
 * @param userRequest - The user's current request
 * @returns Formatted prompt string for workflow extraction
 */
export const queryExtractionPrompt = ({
  connectedApps,
  conversationContext,
  userRequest,
}: {
  connectedApps: string[];
  conversationContext: string;
  userRequest: string;
}) => `Extract workflow from request.

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
"Create issue in Linear" → {"toolkit": "linear", "use_case": "Create issue"}
"Update my GitHub PR" → {"toolkit": "github", "use_case": "Update pull request"}
"Send message to engineering channel" → {"toolkit": "slack", "use_case": "Send message to channel"}

Return JSON only:`;
