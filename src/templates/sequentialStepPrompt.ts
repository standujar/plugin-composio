/**
 * Generates a prompt for sequential tool execution
 * @param stepNumber - Current step number
 * @param totalSteps - Total number of steps
 * @param toolName - Name of the tool to execute
 * @param previousContext - Context from previous tool executions
 * @param conversationContext - Previous conversation context
 * @param userRequest - The original user request
 * @returns Formatted prompt string for the LLM
 */
export const sequentialStepPrompt = ({
  stepNumber,
  totalSteps,
  toolName,
  previousContext,
  conversationContext,
  userRequest,
  agentResponseStyle,
}: {
  stepNumber: number;
  totalSteps: number;
  toolName: string;
  previousContext?: string;
  conversationContext?: string;
  userRequest: string;
  agentResponseStyle?: string;
}) => {
  const contextSection = conversationContext ? `${conversationContext}\n\n` : '';
  const previousSection = previousContext ? `Previous tool results:\n${previousContext}\n\n` : '';
  const styleSection = agentResponseStyle ? `Agent response style: ${agentResponseStyle}\n\n` : '';
  
  return `${styleSection}${contextSection}Original user request: "${userRequest}"

${previousSection}Step ${stepNumber} of ${totalSteps}: Execute ${toolName}

IMPORTANT INSTRUCTIONS:
1. You are executing tool ${stepNumber} out of ${totalSteps} total tools
2. Use the ${toolName} tool to complete this part of the workflow
3. Consider the original user request and previous tool results when executing this tool
4. Pass relevant information to the next step
5. Focus on completing this specific step successfully while keeping the original request in mind
6. After executing, provide ONLY key data in ONE SHORT SENTENCE:
   - For project listing: "Found project [name] (ID: [id])"
   - For issues: "Retrieved [count] issues"
   - Include ONLY IDs and names, no descriptions
7. BE EXTREMELY CONCISE - Maximum 15 words

Execute the tool and provide the result.`;
};

/**
 * Generates a prompt for announcing what the agent is about to do
 * @param toolName - Name of the tool to execute
 * @param purpose - Purpose of using this tool
 * @param stepNumber - Current step number
 * @param totalSteps - Total number of steps
 * @param conversationContext - Recent conversation for language detection
 * @returns Formatted prompt for generating a natural announcement
 */
export const toolAnnouncementPrompt = ({
  toolName,
  purpose,
  stepNumber,
  totalSteps,
  conversationContext,
  userRequest,
  agentResponseStyle,
}: {
  toolName: string;
  purpose: string;
  stepNumber: number;
  totalSteps: number;
  conversationContext?: string;
  userRequest: string;
  agentResponseStyle?: string;
}) => {
  const styleSection = agentResponseStyle ? `Agent response style: ${agentResponseStyle}\n\n` : '';
  return `${styleSection}${conversationContext ? `${conversationContext}\n\n` : ''}User request: "${userRequest}"

Current step ${stepNumber}/${totalSteps}: Using ${toolName} to ${purpose}

Instructions:
- ONE SHORT SENTENCE ONLY (max 10-15 words)
- Just say what you're doing, very briefly
- Match user's language
- No explanations, no "why", no details
- Be ultra concise

Generate only the announcement.`;
};

/**
 * Generates the final summary prompt after all tools have been executed
 * @param allResults - Combined results from all tool executions
 * @param conversationContext - Previous conversation context
 * @param userRequest - The original user request
 * @param agentResponseStyle - Agent's response style
 * @returns Formatted prompt for final summary
 */
export const finalSummaryPrompt = ({
  allResults,
  conversationContext,
  userRequest,
  agentResponseStyle,
}: {
  allResults: string;
  conversationContext?: string;
  userRequest: string;
  agentResponseStyle?: string;
}) => {
  const contextSection = conversationContext ? `${conversationContext}\n\n` : '';
  const styleSection = agentResponseStyle ? `Agent response style: ${agentResponseStyle}\n\n` : '';
  
  return `${styleSection}${contextSection}Original user request: "${userRequest}"

Previous tool results:
${allResults}

Final step: Execute the last tool and provide complete results

Instructions:
- Execute the provided tool to complete the workflow
- Include ALL details from the final tool results (IDs, titles, descriptions, assignees, status)
- Format the response clearly and structured
- Be thorough but concise
- This is the completion of the user's request
- Provide the final answer based on all tool executions

Execute the tool and generate your final response.`;
};