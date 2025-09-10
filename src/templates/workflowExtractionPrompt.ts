/**
 * Generates a prompt to extract workflow steps (toolkits and use cases) from user request
 * @param connectedApps - List of connected app names
 * @param conversationContext - Previous conversation context
 * @param userRequest - The user's current request
 * @returns Formatted prompt string for workflow extraction
 */
export const workflowExtractionPrompt = ({
  connectedApps,
  conversationContext,
  userRequest,
}: {
  connectedApps: string[];
  conversationContext: string;
  userRequest: string;
}) => `Extract ALL toolkits and use cases from the request. Always return an array.

Request: "${userRequest}"
${conversationContext ? `Context: ${conversationContext}` : ''}
Apps: ${connectedApps.join(', ')}

Rules:
- Extract ALL apps mentioned in the request
- Each toolkit can appear multiple times with different use cases
- Use verb + action format for use cases
- Order in array defines execution sequence
- Only select apps from the connected apps list above
- Exclude Composio internal tools and consider that if the app is on the connected list, then the user is already connected

JSON format (always an array):
{
  "toolkits": [
    { "name": "app_name", "use_case": "verb + action" },
    { "name": "app_name", "use_case": "verb + action" }
  ]
}

Examples:
"Create issue in Linear" → {"toolkits": [{"name": "linear", "use_case": "create issue"}]}

"Create issue in Linear, then notify team on Slack" → {"toolkits": [
  {"name": "linear", "use_case": "create issue"},
  {"name": "slack", "use_case": "send message to channel"}
]}

"Create Linear issue, assign to Alice, then create GitHub PR" → {"toolkits": [
  {"name": "linear", "use_case": "create issue"},
  {"name": "linear", "use_case": "assign to user"},
  {"name": "github", "use_case": "create pull request"}
]}

Return JSON only:`;
