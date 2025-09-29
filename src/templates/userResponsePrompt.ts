import type { UserResponsePromptParams } from '../types';

export const userResponsePrompt = ({
  action,
  data,
  userMessage,
}: UserResponsePromptParams): string => {
  const baseContext = `
## USER REQUEST
${userMessage}

## INSTRUCTIONS
Provide a natural, conversational response to the user's request.
Be clear and concise while maintaining a helpful tone.
Do not include greetings.
`;

  switch (action) {
    case 'connect':
      return `${baseContext}
## CONNECTION DETAILS
- Toolkit: ${data.toolkit}
- Status: ${data.status || 'initiated'}
- Success: ${data.success ? 'Yes' : 'In Progress'}
${data.redirectUrl ? `- Authentication URL: ${data.redirectUrl}` : ''}
${data.instruction ? `- Instructions: ${data.instruction}` : ''}
${data.message ? `- System Message: ${data.message}` : ''}

## RESPONSE GUIDELINES
- If redirect URL exists, ALWAYS include the complete URL in your response as plain text
- Do NOT use markdown link format like [text](url), just paste the raw URL
- Clearly explain the user needs to visit this URL to complete authentication
- If already connected, confirm it's ready to use
- If there's an error, explain what went wrong and suggest next steps
- Keep the response encouraging and action-oriented`;

    case 'disconnect':
      return `${baseContext}
## DISCONNECTION DETAILS  
- Toolkit: ${data.toolkit}
- Success: ${data.success ? 'Yes' : 'No'}
${data.message ? `- Message: ${data.message}` : ''}

## RESPONSE GUIDELINES
- Confirm the toolkit has been disconnected
- Mention they can reconnect anytime if needed
- Be brief and confirmatory`;

    case 'list':
      return `${baseContext}
## CONNECTED TOOLKITS
${data.toolkits && data.toolkits.length > 0 
  ? `The following apps are currently connected:\n${data.toolkits.map(t => `- ${t}`).join('\n')}`
  : 'No toolkits currently connected'}

## RESPONSE GUIDELINES
- You MUST list the connected apps shown above
- Present them in a clear, readable format
- If apps are connected, confirm they are ready to use
- You can mention they can connect more apps or disconnect unused ones`;

    case 'browse':
      return `${baseContext}
## BROWSE RESULTS
- Category: ${data.category || 'all'}
- Found: ${data.count || 0} toolkits
${data.toolkits && data.toolkits.length > 0
  ? `\nAvailable toolkits:\n${data.toolkits.slice(0, 10).map(t => `- ${t}`).join('\n')}`
  : ''}

## RESPONSE GUIDELINES  
- Present the available toolkits clearly
- If searching by category, confirm what was searched
- Suggest the user can connect any of these toolkits
- If too many results, show the most relevant ones`;

    case 'progress':
      return `${baseContext}
## WORKFLOW PROGRESS
- Current step: ${data.currentStepIndex + 1} of ${data.totalSteps}
- Just completed: ${data.currentGroup} - ${data.currentUseCase}
- Next step: ${data.nextGroup} - ${data.nextUseCase}

## COMPLETED STEP OUTPUT
${data.completedResponse}

## RESPONSE GUIDELINES
- Acknowledge what was just completed (reference the output above)
- Indicate you're moving to the next step
- Briefly mention what's coming next
- Be concise (1-2 sentences max)
- Use transitional phrases like "Now", "Next", "Moving on to"
- Make it feel like a smooth workflow
- Example: "Great! I've found your Linear issues. Now let me compose that email summary..."`;

    default:
      return baseContext;
  }
};