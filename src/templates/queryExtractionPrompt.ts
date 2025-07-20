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
}) => `Analyze the user request and generate a complete workflow description.

User request: "${userRequest}"
${conversationContext ? `Context: ${conversationContext}` : ''}

Connected apps available: ${connectedApps.join(', ')}

Your task is to:
1. Identify which app/service (toolkit) from the connected apps above is most relevant for this request
2. Create a comprehensive use case description that explains the complete workflow

IMPORTANT: 
- You MUST select ONE toolkit from the connected apps list above
- The use case should be a detailed description of what needs to be done
- Include all logical steps and dependencies in your workflow description

Return a JSON object with:
{
  "toolkit": "the_connected_app_name",
  "use_case": "A brief, direct description of what the user wants. Keep it simple and action-oriented. Maximum 2 sentences."
}

EXAMPLES:

User: "Create a new issue in Linear"
Response: {
  "toolkit": "linear",
  "use_case": "Create a new issue in Linear. This requires first listing available projects and teams members of the project to determine where to create the issue, then creating the issue with the appropriate title, description, and assignment."
}

User: "Update the status of my GitHub PR"
Response: {
  "toolkit": "github",
  "use_case": "Update the status of a GitHub pull request. This involves searching for the user's pull requests, identifying the specific PR to update, and then modifying its status or adding comments as requested."
}

User: "Send a message to the engineering channel"
Response: {
  "toolkit": "slack",
  "use_case": "Send a message to the engineering channel in Slack. This requires listing available channels to find the engineering channel, then composing and sending the message to that specific channel."
}

User: "Get my last email"
Response: {
  "toolkit": "gmail",
  "use_case": "Get the user's last email. This involves searching through the user's email inbox to find the most recent email."
}

Return ONLY the JSON object:`;
