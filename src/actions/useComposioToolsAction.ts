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
} from '../types';

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
      const composioService = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);
      if (!composioService) {
        throw new Error('Composio service not available');
      }

      // Get Composio client
      const composioClient = composioService.getComposioClient();
      if (!composioClient) {
        throw new Error('Composio client not available');
      }

      // Get user ID for Composio operations
      const userId = composioService.getServiceConfig()?.userId || 'default';

      // Step 1: Get connected apps
      const connectedApps = await composioService.getConnectedApps();
      
      if (connectedApps.length === 0) {
        logger.warn('No connected apps found');
        if (callback) {
          callback({
            text: 'No apps are connected. Please connect apps in your Agent dashboard first.',
            content: {
              text: 'No apps are connected. Please connect apps in your Agent dashboard first.',
            },
          });
        }
        return;
      }

      // Prepare conversation context once for both steps
      let conversationContext = '';
      
      // Log message structure for debugging
      logger.debug('Message structure:', {
        hasEntityId: 'entityId' in message,
        messageKeys: Object.keys(message),
        messageEntityId: message.entityId,
      });
      
      if (state?.recentMessagesData && state.recentMessagesData.length > 0) {
        // Get the current user ID from the message
        const currentUserId = message.entityId;
        
        // Filter to get only messages in this conversation
        const relevantMessages = state.recentMessagesData
          .filter(msg => {
            // Include messages from this user or from the agent
            return msg.entityId === currentUserId || msg.entityId === runtime.agentId;
          })
          .slice(-10); // Take last 10 messages to get a good exchange context
        
        if (relevantMessages.length > 0) {
          conversationContext = 'Recent conversation:\n' + 
            relevantMessages.map(msg => {
              const sender = msg.entityId === currentUserId ? 'User' : 'Agent';
              return `${sender}: ${msg.content.text}`;
            }).join('\n');
        }
      }

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
        if (callback) {
          callback({
            text: `The ${toolkit} app is not connected. Please connect it first in your Composio dashboard.`,
            content: {
              text: `The ${toolkit} app is not connected. Please connect it first in your Composio dashboard.`,
            },
          });
        }
        return;
      }

      logger.info(`Using COMPOSIO_SEARCH_TOOLS for toolkit: ${selectedToolkit} with use case: ${useCase}`);

      // Step 2: Use COMPOSIO_SEARCH_TOOLS to find the most relevant tools
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
        if (callback) {
          callback({
            text: `Unable to find tools for ${toolkit}. Please ensure the ${toolkit} app is connected in your Agent dashboard.`,
            content: {
              text: `Unable to find tools for ${toolkit}. Please ensure the ${toolkit} app is connected in your Agent dashboard.`,
              error: searchResult?.error,
            },
          });
        }
        return;
      }

      // Step 3: Get tools directly from SDK
      let tools: VercelAIToolCollection = {};

      if (searchResult?.data?.results && Array.isArray(searchResult.data.results)) {
        logger.debug(`Found ${searchResult.data.results.length} tools from COMPOSIO_SEARCH_TOOLS`);
        logger.debug(`Tools names: ${JSON.stringify(searchResult.data.results.map((result) => result.tool))}`);
        logger.debug(`Search result reasoning: ${searchResult.data.reasoning}`);

        // Get all tool names from search results
        const toolNames = searchResult.data.results.map((result) => result.tool).filter(Boolean);

        if (toolNames.length > 0) {
          tools = await composioClient.tools.get(userId, {
            tools: toolNames,
          });
          logger.debug(`Retrieved ${Object.keys(tools).length} tools in Vercel AI format`);
        }
      }

      if (Object.keys(tools).length === 0) {
        logger.warn('No tools found or retrieved');
        if (callback) {
          callback({
            text: `I couldn't find any tools to help with: "${useCase}". Please try rephrasing your request.`,
            content: {
              text: `I couldn't find any tools to help with: "${useCase}". Please try rephrasing your request.`,
            },
          });
        }
        return;
      }

      // Log the conversation context for debugging
      logger.info('Conversation context prepared:', {
        hasContext: !!conversationContext,
        contextLength: conversationContext.length,
        context: conversationContext,
      });

      const prompt = contextualPrompt({
        userRequest: useCase,
        conversationContext,
      });

      // Log the final prompt
      logger.info('Final contextual prompt:', prompt);

      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        tools,
        toolChoice: 'auto',
        temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
      });

      // Check if we have a valid response
      if (!response || response.trim() === '') {
        logger.warn('Empty response from tool execution, using fallback');

        if (callback) {
          callback({
            text: "I executed the requested tools but couldn't generate a proper response. The tools may not be completed successfully.",
            content: {
              text: "I executed the requested tools but couldn't generate a proper response. The tools may not be completed successfully.",
            },
          });
        }
      } else {
        // We have a proper response from the model
        if (callback) {
          callback({
            text: response,
            content: { text: response },
          });
        }
      }
    } catch (error) {
      logger.error('Error in useComposioToolsAction:', error);

      if (callback) {
        callback({
          text: 'Sorry, I encountered an error while trying to use the available tools.',
          content: {
            text: 'Sorry, I encountered an error while trying to use the available tools.',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  },

  examples: composioToolsExamples,
};
