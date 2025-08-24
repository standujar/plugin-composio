import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  logger,
} from '@elizaos/core';
import { COMPOSIO_DEFAULTS } from '../config/defaults';
import { executeToolsExamples } from '../examples';
import type { ComposioResultsProvider } from '../providers';
import type { ComposioService } from '../services';
import { toolExecutionPrompt, toolkitUseCaseExtractionPrompt } from '../templates';
import {
  COMPOSIO_SERVICE_NAME,
  type ComposioSearchToolsResponse,
  type DependencyTool,
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

      // Step 1: Get connected apps for the effective user
      const effectiveUserId = composioService.isMultiUserMode() ? message.entityId : userId;
      const connectedApps = await composioService.getConnectedApps(effectiveUserId);

      if (connectedApps.length === 0) {
        logger.info('No connected apps found');
        sendErrorCallback(callback, 'No apps are connected. Please connect apps in your Agent dashboard first.');
        return;
      }

      // Build conversation context and get agent style
      const conversationContext = buildConversationContext(state, message, runtime);
      const agentResponseStyle = getAgentResponseStyle(state);

      // Step 2: Extract toolkit and use case from user request
      const workflowResponse = (await runtime.useModel(ModelType.OBJECT_LARGE, {
        prompt: toolkitUseCaseExtractionPrompt({
          connectedApps,
          conversationContext,
          userRequest: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_EXTRACTION_TEMPERATURE,
      })) as WorkflowExtractionResponse;

      const { toolkit, use_case: useCase } = workflowResponse;

      if (!toolkit || !useCase) {
        logger.info('Invalid workflow response format:', JSON.stringify(workflowResponse));
        return;
      }

      // Check if the toolkit is in our connected apps
      const selectedToolkit = connectedApps.find((app) => app.toLowerCase() === toolkit.toLowerCase());

      if (!selectedToolkit) {
        logger.info(`LLM suggested toolkit "${toolkit}" but it's not in connected apps: [${connectedApps.join(', ')}]`);
        sendErrorCallback(
          callback,
          `The ${toolkit} app is not connected. Please connect it first in your Composio dashboard.`,
        );
        return;
      }

      logger.info(`Using COMPOSIO_SEARCH_TOOLS for toolkit: ${selectedToolkit} with use case: ${useCase}`);

      // Get previous executions from provider
      const resultsProvider = runtime.providers.find((p) => p.name === 'COMPOSIO_RESULTS') as ComposioResultsProvider;
      const previousExecutions = resultsProvider?.getToolkitExecutions(selectedToolkit) || [];

      logger.info(
        `[ComposioResults] Found ${previousExecutions.length} previous executions for toolkit: ${selectedToolkit}`,
      );

      // Step 3: Search for the main tool
      const searchResult = (await composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
        userId: effectiveUserId,
        arguments: {
          use_case: useCase,
          toolkits: [toolkit.toLowerCase()],
        },
      })) as ComposioSearchToolsResponse;

      logger.info('Search reasoning result:', searchResult.data.reasoning);

      if (!searchResult?.successful || !searchResult?.data?.results || searchResult.data.results.length === 0) {
        logger.info(`COMPOSIO_SEARCH_TOOLS failed: ${searchResult?.error}`);
        sendErrorCallback(
          callback,
          `Unable to find tools for ${toolkit}. Please ensure the ${toolkit} app is connected in your Agent dashboard.`,
          searchResult?.error,
        );
        return;
      }

      // Get the main tool
      const mainToolSlug = searchResult.data.results[0].tool_slug || searchResult.data.results[0].tool;
      logger.info(`Main tool identified: ${mainToolSlug}`);

      // Step 4: Get dependency graph for the main tool and include ALL dependencies
      const dependencyGraphResult = await composioService.getToolDependencyGraph(mainToolSlug, effectiveUserId);

      // Check if we have dependencies and include them all
      const parentTools: DependencyTool[] = dependencyGraphResult?.parent_tools || [];
      let toolsToFetch = [mainToolSlug];

      if (parentTools.length > 0) {
        logger.info(`Found ${parentTools.length} dependencies for ${mainToolSlug}, including all of them`);

        // Include ALL dependencies - let the final LLM decide which ones to use and how
        const allDependencyTools = parentTools.map((dep) => dep.tool_name);
        toolsToFetch = [mainToolSlug, ...allDependencyTools];

        logger.info(`Including all dependencies: ${allDependencyTools.join(', ')}`);
      } else {
        logger.info(`No dependencies found for ${mainToolSlug}`);
      }

      // Step 5: Get all needed tools from SDK
      logger.info(`Fetching ${toolsToFetch.length} tools: ${toolsToFetch.join(', ')}`);

      const tools: VercelAIToolCollection = await composioClient.tools.get(effectiveUserId, {
        tools: toolsToFetch,
      });

      if (Object.keys(tools).length === 0) {
        logger.info('No tools found or retrieved');
        sendErrorCallback(
          callback,
          `I couldn't find any tools to help with: "${useCase}". Please try rephrasing your request.`,
        );
        return;
      }

      // Step 6: Execute with context
      const prompt = toolExecutionPrompt({
        userRequest: useCase,
        conversationContext,
        agentResponseStyle: agentResponseStyle,
        previousExecutions: previousExecutions,
        dependencyGraph: parentTools,
      });

      logger.info('Executing tools with contextual prompt');

      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        tools,
        toolChoice: 'auto',
        temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
      });

      // Extract the response text
      let responseText = '';

      if (isModelToolResponse(response) && response.text) {
        responseText = response.text;
      } else {
        responseText = extractResponseText(response);
      }

      // Store the execution results if we have tool results (only successful ones)
      if (isModelToolResponse(response) && response.toolResults && resultsProvider && selectedToolkit) {
        const successfulResults = response.toolResults
          .map((toolResult, index) => {
            const toolCall = response.toolCalls?.[index];
            // Only include successful results
            if (
              toolResult.result &&
              typeof toolResult.result === 'object' &&
              'successful' in toolResult.result &&
              toolResult.result.successful === true
            ) {
              return {
                tool: toolCall?.toolName || `tool_${index}`,
                result: toolResult.result,
              };
            }
            return null;
          })
          .filter((result) => result !== null);

        if (successfulResults.length > 0) {
          resultsProvider.storeExecution(selectedToolkit, useCase, successfulResults);
          logger.info(
            `[StoreResults] Stored ${successfulResults.length} successful tool execution results for toolkit: ${selectedToolkit}`,
          );
        }
      }

      // Send response
      if (!responseText || responseText.trim() === '') {
        logger.info('Empty response from tool execution, using fallback');
        sendErrorCallback(
          callback,
          "I executed the requested tools but couldn't generate a proper response. The tools may not have completed successfully.",
        );
      } else {
        sendSuccessCallback(callback, responseText);
      }
    } catch (error) {
      logger.error('Error in useComposioToolsAction:', error);
      sendErrorCallback(callback, 'Sorry, I encountered an error while trying to use the available tools.', error);
    }
  },

  examples: executeToolsExamples,
};
