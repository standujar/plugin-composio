export const dependencyAnalysisPrompt = ({
  userRequest,
  conversationContext,
  retrievedTools,
  previousExecutions = []
}: {
  userRequest: string;
  conversationContext: string;
  retrievedTools: Record<string, any>;
  previousExecutions?: Array<{
    timestamp: number;
    useCase: string;
    results: Array<{
      tool: string;
      result: any;
    }>;
  }>;
}) => `Analyze the user's request to determine if we need to fetch additional data before executing the main task.

## USER REQUEST
${userRequest}

## CONTEXT
${conversationContext ? conversationContext : 'No prior context'}

## AVAILABLE DATA FROM PREVIOUS EXECUTIONS
${previousExecutions.length > 0 ? 
  previousExecutions.map(exec => 
    `### Execution: ${exec.useCase}
Results: ${JSON.stringify(exec.results.map(r => ({ tool: r.tool, result: r.result })), null, 2)}`
  ).join('\n\n')
  : 'No previous executions for this toolkit'}

## CURRENT TOOLS
${JSON.stringify(retrievedTools, null, 2)}

## DEPENDENCY ANALYSIS LOGIC

1. **Identify Required Parameters**
   - Look for parameters ending with: _id, _ref, _key, _identifier, Id, Ref, Key, Identifier
   - Check if they are marked as required in the tool definition
   - Check if the user mentions them explicitly (even if optional)

2. **Check Data Availability** (in priority order)
   For each identified parameter, check if the value is available from:
   1. **Previous tool executions** (HIGHEST PRIORITY - most reliable source)
   2. The user's message directly (e.g., "delete issue USEK-163")
   3. Default values in the tool definition
   4. The conversation context (LOWEST PRIORITY - may be outdated or imprecise)

3. **Analyze Tool Parameters Recursively**
   For each tool in CURRENT TOOLS, examine its required parameters:
   - Check if ALL required parameters can be satisfied
   - If a tool needs data that isn't available, identify what tools could provide that data

4. **Determine Missing Dependencies**
   - If a required parameter is NOT available from any source → Add to dependencies
   - If an optional parameter is mentioned by user but NOT available → Add to dependencies
   - If data exists in previous executions → DO NOT add to dependencies (avoid redundant API calls)

4. **Create Dependency Use Case**
   Only if there are missing dependencies:
   - Create a natural language description of what data to fetch
   - Use resource names, not technical terms (e.g., "Get project" not "Get project ID")
   - Combine multiple needs into one sentence when possible

## EXAMPLES

Example 1 - GitHub (No dependencies needed):
User: "Close the pull request I just created"
Previous execution: {tool: "GITHUB_PULLS_CREATE", result: {number: 42, html_url: "github.com/..."}}
Analysis: The PR number is available from previous execution
Result: {
  "hasDependencies": false, 
  "useCase": "",
  "relevantExecutions": [{
    "useCase": "Create pull request",
    "results": [{"tool": "GITHUB_PULLS_CREATE", "result": {"number": 42, "html_url": "github.com/..."}}]
  }]
}

Example 2 - Slack (Dependencies needed):
User: "Send a message to the engineering channel"
Previous executions: [
  {tool: "SLACK_POST_MESSAGE", result: {channel: "C123", ts: "..."}},  // Different channel
  {tool: "SLACK_USERS_LIST", result: [{id: "U456", name: "John"}]}    // Not relevant
]
Analysis: Need channel ID for "engineering", previous executions don't help
Result: {
  "hasDependencies": true, 
  "useCase": "List channels to find engineering channel",
  "relevantExecutions": []  // None are relevant for finding engineering channel
}

Example 3 - Notion (Mixed relevance):
User: "Add a new page to database DB-123 with John as assignee"
Previous executions: [
  {tool: "NOTION_SEARCH_USERS", result: [{id: "usr_456", name: "John Smith"}]},
  {tool: "NOTION_CREATE_PAGE", result: {id: "page_789"}},  // Not relevant
  {tool: "NOTION_LIST_DATABASES", result: [{id: "DB-999"}]}  // Not relevant
]
Analysis: Database ID provided, John's ID found in previous execution
Result: {
  "hasDependencies": false,
  "useCase": "",
  "relevantExecutions": [{
    "useCase": "Search Notion users",
    "results": [{"tool": "NOTION_SEARCH_USERS", "result": [{"id": "usr_456", "name": "John Smith"}]}]
  }]
}

## RESPONSE FORMAT
Return a JSON object:
{
  "hasDependencies": boolean,
  "useCase": string,  // Only populated if hasDependencies is true
  "relevantExecutions": [  // Previous executions that are relevant to the current task
    {
      "useCase": string,
      "results": [{"tool": string, "result": object}]
    }
  ]
}

Examples of relevantExecutions filtering:
- User wants to "delete the issue I created" → Include CREATE_ISSUE execution
- User wants to "send message to John" → Include any execution that found John's user ID
- User wants to "list all projects" → Don't include previous issue/task creations
- User wants to "update the PR" → Include PR creation or previous PR searches`;