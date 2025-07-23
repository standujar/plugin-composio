export const queryExtractionPrompt = ({
  connectedApps,
  conversationContext,
  userRequest,
}: {
  connectedApps: string[];
  conversationContext: string;
  userRequest: string;
}) => `Analyze the user request and extract ALL necessary queries in logical order.

Connected apps: ${connectedApps.join(', ')}
User request: "${userRequest}"
${conversationContext ? `Context: ${conversationContext}` : ''}

🔴 CRITICAL: Break down the request into MULTIPLE atomic actions!

LOGICAL DECOMPOSITION RULES:
1. BEFORE creating → you must LIST/FIND where to create
2. BEFORE updating → you must FIND what to update  
3. BEFORE deleting → you must SEARCH/LIST what to delete
4. BEFORE assigning → you must LIST available assignees or existing members / teams
5. BEFORE adding to something → you must GET that something first
6. BEFORE filtering → you must LIST all items first

QUERY FORMAT:
- Use EXACTLY the app name from connected apps
- Each query: 3-4 words MAX (verb + object)
- NO specific values, IDs or names in queries
- Return JSON array of {"toolkit": "app", "query": "action object"}

THINK LIKE THIS:
User wants to "create a ticket" →
1. I need to LIST PROJECTS first (to know where to create)
2. Maybe LIST TEAMS too (if project needs team)
3. Maybe LIST USERS (if I need to assign)
4. Then CREATE ISSUE

User wants to "update something" →
1. I need to SEARCH/LIST items first
2. Then UPDATE item

⚠️ ALWAYS err on the side of MORE queries rather than fewer!
Better to have extra data than to fail because of missing context.

EXAMPLE OUTPUTS (notice the logical flow):
[{"toolkit": "linear", "query": "list teams"}, {"toolkit": "linear", "query": "list projects"}, {"toolkit": "linear", "query": "create issue"}]
[{"toolkit": "github", "query": "list repositories"}, {"toolkit": "github", "query": "create issue"}]
[{"toolkit": "slack", "query": "list channels"}, {"toolkit": "slack", "query": "send message"}]

Return JSON array with queries in logical execution order:`;
