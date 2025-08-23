export const toolkitExtractionPrompt = ({
  userMessage,
}: {
  userMessage: string;
}) => `Extract the toolkit/app name that the user wants to connect from this message.

## USER MESSAGE
${userMessage}

## INSTRUCTIONS

1. **Identify the Toolkit**
   - Look for app/service names like: gmail, slack, github, linear, notion, google_calendar, twitter, discord, etc.
   - Consider variations: "Google Mail" → gmail, "Google Calendar" → google_calendar
   - Handle common aliases: "Git" → github, "Google Drive" → google_drive

2. **Confidence Assessment**
   - HIGH: Clear, specific toolkit name mentioned (e.g., "connect Gmail", "add Slack")
   - MEDIUM: Toolkit implied but not explicit (e.g., "connect my email" could be gmail)
   - LOW: No clear toolkit mentioned or ambiguous request

## RESPONSE FORMAT
Return a JSON object:
{
  "toolkit": "toolkit_name_in_lowercase",
  "confidence": "high|medium|low"
}

## EXAMPLES

Input: "I want to connect Gmail to my account"
Output: {"toolkit": "gmail", "confidence": "high"}

Input: "Add Slack integration please"  
Output: {"toolkit": "slack", "confidence": "high"}

Input: "Connect my email"
Output: {"toolkit": "gmail", "confidence": "medium"}

Input: "Help me with something"
Output: {"toolkit": "", "confidence": "low"}`;