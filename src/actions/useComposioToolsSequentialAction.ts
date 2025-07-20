import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';
import truncateJson from 'truncate-json';
import { COMPOSIO_DEFAULTS } from '../config/defaults';
import { composioToolsExamples } from '../examples';
import type { ComposioService } from '../services';
import { queryExtractionPrompt } from '../templates';
import { 
  sequentialStepPrompt, 
  toolAnnouncementPrompt,
  finalSummaryPrompt
} from '../templates/sequentialStepPrompt';
import {
  COMPOSIO_SERVICE_NAME,
  type ComposioSearchToolsResponse,
  type VercelAIToolCollection,
  type WorkflowExtractionResponse,
  extractResponseText,
  isModelToolResponse,
} from '../types';
import { 
  buildConversationContext, 
  getAgentResponseStyle,
  initializeComposioService,
  sendErrorCallback,
  sendSuccessCallback,
} from '../utils';

export const useComposioToolsSequentialAction: Action = {
  name: 'USE_COMPOSIO_TOOLS',
  similes: [
    'CALL_COMPOSIO_TOOL',
    'USE_TOOL',
    'CALL_TOOL',
    'EXECUTE_COMPOSIO_TOOL',
    'RUN_COMPOSIO_TOOL',
    'INVOKE_COMPOSIO_TOOL',
    'USE_COMPOSIO',
    'COMPOSIO_ACTION',
  ],
  description: 'Use Composio tools to perform tasks with external integrations',

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const composioService = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);
    return !!composioService?.isInitialized();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<void> => {
    try {
      // Initialize Composio service
      const { service: composioService, client: composioClient, userId } = await initializeComposioService(runtime);

      // Step 1: Get connected apps
      const connectedApps = await composioService.getConnectedApps();
      
      if (connectedApps.length === 0) {
        logger.warn('No connected apps found');
        sendErrorCallback(callback, 'No apps are connected. Please connect apps in your Agent dashboard first.');
        return;
      }
      
      // Build conversation context and get agent style
      const conversationContext = buildConversationContext(state, message, runtime);
      const agentResponseStyle = getAgentResponseStyle(state);

      // Step 2: Extract workflow description from user request
      const workflowResponse = (await runtime.useModel(ModelType.OBJECT_LARGE, {
        prompt: queryExtractionPrompt({
          connectedApps,
          conversationContext,
          userRequest: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.WORKFLOW_EXTRACTION_TEMPERATURE,
      })) as WorkflowExtractionResponse;

      // Parse the response to get toolkit and use_case
      const { toolkit, use_case: useCase } = workflowResponse;

      if (!toolkit || !useCase) {
        logger.error('Invalid workflow response format:', workflowResponse);
        return;
      }

      // Check if the toolkit is in our connected apps
      const selectedToolkit = connectedApps.find((app) => app.toLowerCase() === toolkit.toLowerCase());
      
      if (!selectedToolkit) {
        logger.warn(`LLM suggested toolkit "${toolkit}" but it's not in connected apps: [${connectedApps.join(', ')}]`);
        sendErrorCallback(callback, `The ${toolkit} app is not connected. Please connect it first in your Composio dashboard.`);
        return;
      }

      // Step 3: Use COMPOSIO_SEARCH_TOOLS to find the most relevant tools
      const searchResult = (await composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
        userId,
        arguments: {
          use_case: useCase,
          toolkits: [toolkit.toLowerCase()],
        },
      })) as ComposioSearchToolsResponse;

      logger.debug('Search reasoning result:', searchResult.data.reasoning);

      // Check if the search was successful
      if (!searchResult?.successful || searchResult?.error) {
        logger.error(`COMPOSIO_SEARCH_TOOLS failed: ${searchResult?.error}`);
        sendErrorCallback(
          callback,
          `Unable to find tools for ${toolkit}. Please ensure the ${toolkit} app is connected in your Agent dashboard.`,
          searchResult?.error
        );
        return;
      }

      // Step 4: Get tools directly from SDK
      let tools: VercelAIToolCollection = {};

      if (searchResult?.data?.results && Array.isArray(searchResult.data.results)) {

        // Get all tool names from search results
        const toolNames = searchResult.data.results.map((result) => result.tool).filter(Boolean);

        logger.info('Tool names:', toolNames);

        if (toolNames.length > 0) {
          tools = await composioClient.tools.get(userId, {
            tools: toolNames,
          });
        }
      }

      if (Object.keys(tools).length === 0) {
        logger.warn('No tools found or retrieved');
        sendErrorCallback(callback, `I couldn't find any tools to help with: "${useCase}". Please try rephrasing your request.`);
        return;
      }

      // Step 5: Execute tools sequentially in the order returned by search
      // Use the order from searchResult.data.results to maintain the logical workflow
      const orderedToolNames = searchResult.data.results.map((result) => result.tool);
      const toolsList = orderedToolNames.map(toolName => [toolName, tools[toolName]]).filter(([_, tool]) => tool !== undefined);
      const totalSteps = toolsList.length;
      let previousContext = '';
      const allResults: string[] = [];

      for (let i = 0; i < toolsList.length; i++) {
        const [toolName, toolDefinition] = toolsList[i];
        const stepNumber = i + 1;

        // Extract purpose from tool description
        const toolInfo = searchResult.data.results.find(r => r.tool === toolName);
        const purpose = toolInfo?.description || 'complete this step of the workflow';

        // Announce what we're about to do with a natural message
        if (callback) {
          const announcementPrompt = toolAnnouncementPrompt({
            toolName: toolName as string,
            purpose,
            stepNumber,
            totalSteps, 
            conversationContext,
            userRequest: message.content.text,
            agentResponseStyle: agentResponseStyle,
          });
          
          // Use a small model for quick, simple announcements
          const announcement = await runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: announcementPrompt,
            temperature: 0.7,
          });
          
          sendSuccessCallback(callback, announcement.trim());
        }

        // Execute the tool
        logger.info(`Executing tool ${stepNumber}/${totalSteps}: ${toolName}`);
        
        // Use different prompt for last tool vs intermediate tools
        const isLastTool = i === toolsList.length - 1;
        
        // Use different prompts for last tool vs intermediate tools
        let stepPrompt: string;
        
        if (isLastTool) {
          // For the last tool, we need to pass all previous results
          const allPreviousResults = allResults.join('\n\n');
          stepPrompt = finalSummaryPrompt({
            allResults: allPreviousResults,
            conversationContext,
            userRequest: message.content.text,
            agentResponseStyle,
          });
        } else {
          // For intermediate tools, use the concise prompt
          stepPrompt = sequentialStepPrompt({
            stepNumber,
            totalSteps,
            toolName: toolName as string,
            previousContext,
            conversationContext,
            userRequest: message.content.text,
            agentResponseStyle: agentResponseStyle,
          });
        }
        
        logger.debug(`Step ${stepNumber} prompt length: ${stepPrompt.length} chars`);

        try {
          const stepResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: stepPrompt,
            tools: { [toolName as string]: toolDefinition },
            toolChoice: 'auto',
            temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
          });

          // Extract tool results using helper
          const toolResult = extractResponseText(stepResponse);
          
          // Determine what to store as result summary
          let resultForSummary: string;
          
          if (isLastTool && isModelToolResponse(stepResponse) && stepResponse.text) {
            // Last tool: use the formatted response from finalSummaryPrompt
            resultForSummary = stepResponse.text;
            // Send the final formatted response
            sendSuccessCallback(callback, stepResponse.text);
          } else if (!isLastTool) {
            // Intermediate tools: truncate to avoid memory bloat
            const maxIntermediateSize = 500; // Reasonable size for intermediate results
            resultForSummary = toolResult.length > maxIntermediateSize
              ? `${toolResult.substring(0, maxIntermediateSize)}... [truncated]`
              : toolResult;
          } else {
            // Last tool but no text response - this shouldn't happen with finalSummaryPrompt
            logger.error('No text response from final tool despite using finalSummaryPrompt');
            sendSuccessCallback(callback, 'Tools executed successfully but no formatted result was generated.');
            resultForSummary = toolResult;
          }

          if (toolResult && toolResult.trim() !== '') {
            // Store the result (truncated for intermediate, full for last)
            allResults.push(`${toolName}: ${resultForSummary}`);
            
            // Truncate tool result for context passing to avoid token explosion
            const rawResult = isModelToolResponse(stepResponse) 
              ? stepResponse.toolResults?.[0]?.result || toolResult
              : toolResult;
            const maxContextSize = 1000; // Max bytes for context between steps
            
            // Try to truncate the result
            const { jsonString: truncatedResult } = truncateJson(
              JSON.stringify(rawResult), 
              maxContextSize
            );
            
            // Update context for next tool with truncated data
            previousContext = `${previousContext}\n${toolName} result: ${truncatedResult}`;
            
            logger.info(`Tool ${toolName} executed successfully`);
            
            // For intermediate tools, send the LLM's response text
            if (!isLastTool && callback && isModelToolResponse(stepResponse) && stepResponse.text) {
              // Use the LLM's text which should include extracted data
              sendSuccessCallback(callback, stepResponse.text);
            }
          } else {
            logger.warn(`Empty response from tool ${toolName}`);
            allResults.push(`${toolName}: No result returned`);
          }
        } catch (toolError) {
          logger.error(`Error executing tool ${toolName}:`, toolError);
          allResults.push(`${toolName}: Error occurred during execution`);
        }

        // Add a small delay between tools to avoid rate limiting
        if (i < toolsList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Step 6: Final response has already been sent for the last tool
      logger.info('Sequential tool execution completed successfully', {
        toolsExecuted: toolsList.map(([name]) => name),
        totalSteps: totalSteps
      });

    } catch (error) {
      logger.error('Error in useComposioToolsSequentialAction:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while trying to use the available tools sequentially.',
        error
      );
    }
  },

  examples: composioToolsExamples,
};