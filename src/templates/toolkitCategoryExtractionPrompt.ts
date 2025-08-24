export const toolkitCategoryExtractionPrompt = ({
  userMessage,
}: {
  userMessage: string;
}) => `Extract the category/use case from this message for browsing toolkits.

## USER MESSAGE
${userMessage}

## INSTRUCTIONS
1. Extract the core functionality the user wants (e.g., "send email", "project management")
2. Keep it simple and descriptive
3. Return confidence: high (clear), medium (implied), low (vague)

## RESPONSE FORMAT
JSON: {"category": "use_case", "confidence": "high|medium|low"}

## EXAMPLES
"What email apps?" → {"category": "send email", "confidence": "high"}
"Find project tools" → {"category": "project management", "confidence": "high"}
"What can I connect?" → {"category": "", "confidence": "low"}`;