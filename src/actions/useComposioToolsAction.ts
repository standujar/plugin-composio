import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';
import { COMPOSIO_DEFAULTS } from '../config/defaults';
import { composioToolsExamples } from '../examples';
import type { ComposioService } from '../services';
import { contextualPrompt, queryExtractionPrompt } from '../templates';
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

export const useComposioToolsAction: Action = {
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

      logger.info(`Using COMPOSIO_SEARCH_TOOLS for toolkit: ${selectedToolkit} with use case: ${useCase}`);

      // Step 3: Use COMPOSIO_SEARCH_TOOLS to find the most relevant tools
      const searchResult = (await composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
        userId,
        arguments: {
          use_case: useCase,
          toolkits: [toolkit.toLowerCase()],
        },
      })) as ComposioSearchToolsResponse;

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

      const prompt = contextualPrompt({
        userRequest: useCase,
        conversationContext,
        agentResponseStyle: agentResponseStyle,
      });

      // Log the final prompt
      logger.debug('Final contextual prompt:', prompt);

      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        tools,
        toolChoice: 'auto',
        temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
      });

      // Extract the response text - prefer the model's formatted text
      let responseText = '';
      
      if (isModelToolResponse(response) && response.text) {
        // Use the model's formatted text response
        responseText = response.text;
      } else {
        // Fallback to extractResponseText for other cases
        responseText = extractResponseText(response);
      }
      
      // Check if we have a valid response
      if (!responseText || responseText.trim() === '') {
        logger.warn('Empty response from tool execution, using fallback');
        sendErrorCallback(
          callback,
          "I executed the requested tools but couldn't generate a proper response. The tools may not be completed successfully."
        );
      } else {
        // We have a proper response from the model
        sendSuccessCallback(callback, responseText);
      }
    } catch (error) {
      logger.error('Error in useComposioToolsAction:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while trying to use the available tools.',
        error
      );
    }
  },

  examples: composioToolsExamples,
};
