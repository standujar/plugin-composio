export const dependencyAnalysisPrompt = ({
  userRequest,
  conversationContext,
  retrievedTools
}: {
  userRequest: string;
  conversationContext: string;
  retrievedTools: Record<string, any>;
  toolkit: string;
}) => `Create use case from tool parameter descriptions.

Request: ${userRequest}
${conversationContext ? `Context: ${conversationContext}` : ''}

Current tools:
${JSON.stringify(retrievedTools, null, 2)}

Analysis rules:
1. Check what data already exists vs what's needed
2. For each _id, _ref, _key parameter:
   - Required + missing → Add to use case
   - Optional + user mentions it + missing → Add to use case  
   - Already provided → Skip (don't fetch again)
3. Read parameter descriptions for tool hints
4. Create use case ONLY for missing pieces:
   - Example: User provides project_id but not user_id → Only "Search users"
   - Example: All IDs provided → NO dependencies

IMPORTANT: In use cases, use resource names, NOT "ID":
- Wrong: "Get project ID" 
- Right: "Get project"
- Wrong: "List user IDs"
- Right: "List users"

Return JSON:
{
  "hasDependencies": boolean,
  "useCase": "Complete sentence with resource names, no technical IDs"
}

Example use cases:
- "List projects and get team members"
- "Search users, list databases, and fetch workspace details"
- "Get project information and list available assignees"`;