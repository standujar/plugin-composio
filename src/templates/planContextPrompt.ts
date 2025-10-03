/**
 * Generates a prompt to enrich minimal use cases with context for workflow planning
 * @param originalRequest - The user's original request
 * @param toolkit - The toolkit name
 * @param minimalUseCases - The minimal use cases extracted (e.g., "create issue", "send message")
 * @returns Formatted prompt string for enriching the context
 */
export const planContextPrompt = ({
  originalRequest,
  toolkit,
  minimalUseCases,
}: {
  originalRequest: string;
  toolkit: string;
  minimalUseCases: string[];
}) => `Given the user's original request and the extracted minimal use cases, provide enriched context for workflow planning.

Original user request: "${originalRequest}"
Toolkit: ${toolkit}
Minimal actions extracted: ${minimalUseCases.join(', ')}

Your task is to create a more detailed description that:
1. Captures the user's actual intent (not just the generic action)
2. Provides context about what specifically needs to be done
3. Remains concise and focused on the ${toolkit} operations

Return JSON with:
{
  "use_case": "A clear description of what the user wants to achieve with ${toolkit}",
  "reasoning": "Brief explanation of why these ${toolkit} operations are needed"
}

Example:
Input: "Track the new authentication bug in Linear"
Minimal: "create issue"
Output: {
  "use_case": "Create a Linear issue to track an authentication bug",
  "reasoning": "User needs to document and track a bug related to authentication in their Linear workspace"
}

Generate the enriched context:`;