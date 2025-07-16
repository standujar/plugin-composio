export const queryExtractionPrompt = ({
  connectedApps,
  conversationContext,
  userRequest,
}: {
  connectedApps: string[];
  conversationContext: string;
  userRequest: string;
}) => `Analyze the user request and return MULTIPLE queries as a JSON array.

Connected apps: ${connectedApps.join(', ')}
User request: "${userRequest}"
${conversationContext ? `Context: ${conversationContext}` : ''}

⚠️ IMPORTANT: Most requests need MULTIPLE queries! Don't stop at the first action!

RULES:
1. Use EXACTLY the connected app name from the list above
2. Query must be 3-4 words MAX (verb + object)
3. NO usernames, IDs, or specific values
4. Return a JSON array with MULTIPLE objects
5. ALWAYS include prerequisite actions

THINK: What do I need to find/list BEFORE I can do the main action?

WORKFLOW PATTERNS (notice MULTIPLE queries):
- "Create issue/task" → 2 QUERIES: ["list projects", "create issue"]
- "Update item" → 2 QUERIES: ["find item", "update item"]
- "Send message to channel" → 2 QUERIES: ["list channels", "send message"]
- "Comment on PR" → 2 QUERIES: ["list pull requests", "create comment"]
- "Delete old issues" → 2 QUERIES: ["search issues", "delete issue"]

CORRECT EXAMPLES:
[{"toolkit": "github", "query": "list repositories"}]
[{"toolkit": "github", "query": "search users"}, {"toolkit": "github", "query": "list repositories"}]
[{"toolkit": "linear", "query": "list projects"}, {"toolkit": "linear", "query": "list users"}]

WRONG EXAMPLES:
{"actions": [...]} ← NO wrapper object
[{"toolkit": "github", "query": "search repositories for user standujar"}] ← Too many words
[{"toolkit": "connected_app", "query": "list items"}] ← Must use actual app name

Return JSON array:`;
