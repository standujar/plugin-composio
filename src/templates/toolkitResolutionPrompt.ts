import type { ToolkitResolutionPromptParams } from '../types';

export const toolkitResolutionPrompt = ({
  userMessage,
  availableToolkits,
  mode,
}: ToolkitResolutionPromptParams): string => {
  const baseContext = `
## USER MESSAGE
${userMessage}
`;

  switch (mode) {
    case 'extract':
      // Simple extraction from user message
      return `${baseContext}
## TASK
Extract the toolkit/app name that the user wants to work with.

## INSTRUCTIONS
1. Identify the app/service name mentioned (gmail, slack, github, linear, notion, etc.)

## RESPONSE FORMAT
{
  "toolkit": "toolkit_name_in_lowercase",
  "confidence": "high|medium|low"
}

If no clear toolkit is mentioned:
{
  "toolkit": "",
  "confidence": "low"
}`;

    case 'select':
      // Select from a provided list
      return `${baseContext}
## AVAILABLE TOOLKITS
${availableToolkits?.map(t => `- ${t}`).join('\n') || 'No toolkits provided'}

## TASK
Select the most appropriate toolkit from the available options.

## RESPONSE FORMAT
{
  "selectedToolkit": "exact_toolkit_name_from_list",
  "confidence": "high|medium|low"
}

If no toolkit matches:
{
  "selectedToolkit": null,
  "confidence": "low"
}`;

    case 'extract_and_select':
      // Extract intent and select from list in one step
      return `${baseContext}
## AVAILABLE TOOLKITS
${availableToolkits?.map(t => `- ${t}`).join('\n') || 'No toolkits provided'}

## TASK
Analyze the user's request and select the matching toolkit from the available list.

## INSTRUCTIONS
1. Understand what the user wants to connect/use
2. Match their intent to the most appropriate toolkit from the list

## RESPONSE FORMAT
{
  "selectedToolkit": "exact_toolkit_name_from_list",
  "confidence": "high|medium|low"
}

If no toolkit matches:
{
  "selectedToolkit": null,
  "confidence": "low"
}`;

    default:
      throw new Error(`Invalid toolkit resolution mode: ${mode}`);
  }
};