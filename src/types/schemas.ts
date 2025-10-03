import { z } from 'zod';

// Schema for extracting toolkit name from user message
export const extractToolkitSchema = z.object({
  toolkit: z.string().describe("The toolkit/app name in lowercase (e.g., 'gmail', 'slack', 'github')"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the extraction")
});

// Schema for selecting from available toolkits
export const selectToolkitSchema = z.object({
  selectedToolkit: z.string().nullable().describe("Exact toolkit name from the provided list, or null if no match"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the selection")
});

export type ExtractToolkitResponse = z.infer<typeof extractToolkitSchema>;
export type SelectToolkitResponse = z.infer<typeof selectToolkitSchema>;