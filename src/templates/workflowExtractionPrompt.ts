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

CRITICAL RULES FOR USE_CASE GENERATION:
1. Use ONLY these standard action patterns that work across ALL toolkits:
   - "create [resource]" (create issue, create page, create task, create document)
   - "update [resource]" (update issue, update page, update task)
   - "get [resource]" (get issue, get user, get file)
   - "list [resources]" (list issues, list users, list files)
   - "delete [resource]" (delete issue, delete page, delete file)
   - "send [content]" (send message, send email, send notification)
   - "search [resource]" (search issues, search files, search users)
   - "add [item]" (add row, add comment, add member)
   - "remove [item]" (remove row, remove comment, remove member)

2. NEVER include specific details in use_case:
   ❌ BAD: "integrate risk management info into new sheet"
   ✅ GOOD: "create spreadsheet"

   ❌ BAD: "notify team about deployment on slack"
   ✅ GOOD: "send message"

3. Identify the CORE ACTION regardless of context:
   - "Put data in spreadsheet" → "create spreadsheet" or "update spreadsheet"
   - "Inform the team" → "send message"
   - "Track this bug" → "create issue"
   - "Find all open tasks" → "list issues"

JSON format (always an array):
{
  "toolkits": [
    { "name": "app_name", "use_case": "action resource" }
  ]
}

Examples:
"Track bug in Linear" → {"toolkits": [{"name": "linear", "use_case": "create issue"}]}

"Put sales data in Google Sheets and inform team on Slack" → {"toolkits": [
  {"name": "googlesheets", "use_case": "create spreadsheet"},
  {"name": "slack", "use_case": "send message"}
]}

"Update the GitHub PR and close the Linear ticket" → {"toolkits": [
  {"name": "github", "use_case": "update pull request"},
  {"name": "linear", "use_case": "update issue"}
]}

Return JSON only:`;
