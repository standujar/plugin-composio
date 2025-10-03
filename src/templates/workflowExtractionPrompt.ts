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
}) => `Extract toolkits and actions from: "${userRequest}"
${conversationContext ? `Context: ${conversationContext}` : ''}
Available apps: ${connectedApps.join(', ')}

RULES:
1. Use ONLY standard patterns: create/update/get/list/delete/send/search/add/remove + [resource]
2. Keep use_case minimal (e.g., "create issue", NOT "create bug tracking issue")
3. Include reasoning (WHY) and overall use_case (WHAT) for workflow context

Return JSON:
{
  "toolkits": [{"name": "app", "use_case": "action resource"}],
  "reasoning": "Why user needs this and how tools coordinate",
  "use_case": "What user wants to achieve"
}

Examples:
"Track bug in Linear" → {
  "toolkits": [{"name": "linear", "use_case": "create issue"}],
  "reasoning": "User needs to document and track a bug in their project management system",
  "use_case": "Create a Linear issue to track a bug"
}

"Get Linear issues and make Google Doc" → {
  "toolkits": [
    {"name": "linear", "use_case": "list issues"},
    {"name": "googledocs", "use_case": "create document"}
  ],
  "reasoning": "User wants to retrieve issues from Linear and create a document with that list. This requires fetching issues and formatting them into a document.",
  "use_case": "Retrieve issues from Linear and create a Google Doc containing the list."
}`;
