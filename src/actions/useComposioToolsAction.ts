import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';
import { ComposioResultsProvider } from '../providers/ComposioResultsProvider';
import { COMPOSIO_DEFAULTS } from '../config/defaults';
import { composioToolsExamples } from '../examples';
import type { ComposioService } from '../services';
import { contextualPrompt, queryExtractionPrompt, dependencyAnalysisPrompt } from '../templates';
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
        logger.info('No connected apps found');
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
        logger.info('Invalid workflow response format:', JSON.stringify(workflowResponse));
        return;
      }

      // Check if the toolkit is in our connected apps
      const selectedToolkit = connectedApps.find((app) => app.toLowerCase() === toolkit.toLowerCase());
      
      if (!selectedToolkit) {
        logger.info(`LLM suggested toolkit "${toolkit}" but it's not in connected apps: [${connectedApps.join(', ')}]`);
        sendErrorCallback(callback, `The ${toolkit} app is not connected. Please connect it first in your Composio dashboard.`);
        return;
      }

      logger.info(`Using COMPOSIO_SEARCH_TOOLS for toolkit: ${selectedToolkit} with use case: ${useCase}`);

      // Get the provider and retrieve previous executions for this toolkit
      const resultsProvider = runtime.providers.find(p => p.name === 'COMPOSIO_RESULTS') as ComposioResultsProvider;
      const previousExecutions = resultsProvider?.getToolkitExecutions(selectedToolkit) || [];
      
      logger.info(`[ComposioResults] Found ${previousExecutions.length} previous executions for toolkit: ${selectedToolkit}`);
      if (previousExecutions.length > 0) {
        logger.info('[ComposioResults] Previous executions:', JSON.stringify(previousExecutions, null, 2));
      }
      
      // Note: previousExecutions are passed separately to dependencyAnalysisPrompt
      // No need to enrich conversationContext here

      // Step 3: Use COMPOSIO_SEARCH_TOOLS to find the most relevant tools
      const searchResult = (await composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
        userId,
        arguments: {
          use_case: useCase,
          toolkits: [toolkit.toLowerCase()],
        },
      })) as ComposioSearchToolsResponse;

      logger.info('Search reasoning result:', searchResult.data.reasoning);

      // Check if the search was successful
      if (!searchResult?.successful || searchResult?.error) {
        logger.info(`COMPOSIO_SEARCH_TOOLS failed: ${searchResult?.error}`);
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
        const toolNames = searchResult.data.results.map((result) => result.tool_slug || result.tool).filter(Boolean);

        logger.info('Tool names:', JSON.stringify(toolNames));

        if (toolNames.length > 0) {
          tools = await composioClient.tools.get(userId, {
            tools: toolNames,
          });
        }
      }

      if (Object.keys(tools).length === 0) {
        logger.info('No tools found or retrieved');
        sendErrorCallback(callback, `I couldn't find any tools to help with: "${useCase}". Please try rephrasing your request.`);
        return;
      }

      // Step 4: Check for missing dependencies (iterative analysis)
      logger.info('Checking for missing dependencies in retrieved tools');
      
      let hasNewDependencies = true;
      let dependencyIteration = 0;
      const MAX_DEPENDENCY_ITERATIONS = 5; // Prevent infinite loops
      let finalDependencyResult: any = null;
      
      while (hasNewDependencies && dependencyIteration < MAX_DEPENDENCY_ITERATIONS) {
        dependencyIteration++;
        logger.info(`[DependencyAnalysis] Starting iteration ${dependencyIteration}`);
        
        // Analyze dependencies for current tools
        const dependencyResponse = await runtime.useModel(ModelType.OBJECT_LARGE, {
          prompt: dependencyAnalysisPrompt({
            userRequest: message.content.text,
            conversationContext,
            retrievedTools: tools,
            previousExecutions: previousExecutions,
          }),
          temperature: COMPOSIO_DEFAULTS.DEPENDENCY_ANALYSIS_TEMPERATURE,
        });

        // Check if we need to fetch more tools
        const dependencyResult = dependencyResponse as { 
          hasDependencies?: boolean; 
          useCase?: string;
          relevantExecutions?: Array<{
            timestamp: number;
            useCase: string;
            results: Array<{ tool: string; result: any }>;
          }>;
        };
        
        logger.info(`[DependencyAnalysis] Iteration ${dependencyIteration} Result:`, JSON.stringify(dependencyResult, null, 2));
        finalDependencyResult = dependencyResult; // Keep the last result for later use
        
        if (dependencyResult?.hasDependencies) {
          const dependencyUseCase = dependencyResult.useCase;
          if (!dependencyUseCase) {
            logger.info('Dependencies detected but no use case provided, stopping dependency analysis');
            hasNewDependencies = false;
          } else {
            logger.info(`Found missing dependencies, fetching tools for: ${dependencyUseCase}`);
            
            // Track tools before adding new ones
            const toolCountBefore = Object.keys(tools).length;
            
            // Fetch tools for the missing dependencies
            try {
              const dependencySearchResult = (await composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
                userId,
                arguments: {
                  use_case: dependencyUseCase,
                  toolkits: [toolkit.toLowerCase()],
                },
              })) as ComposioSearchToolsResponse;
              
              // Process search results
              if (dependencySearchResult?.data?.results && Array.isArray(dependencySearchResult.data.results)) {
                // Get tool names from search results
                const toolNames = dependencySearchResult.data.results.map((result) => result.tool_slug || result.tool).filter(Boolean);
                
                if (toolNames.length > 0) {
                  // Get the actual tools from Composio
                  const dependencyTools = await composioClient.tools.get(userId, {
                    tools: toolNames,
                  });
                  
                  // Add new tools to our collection
                  for (const [toolId, toolData] of Object.entries(dependencyTools)) {
                    if (!tools[toolId]) { // Only add if we don't already have this tool
                      tools[toolId] = toolData;
                      logger.info(`Found dependency tool: ${toolId}`);
                    }
                  }
                }
              }
              
              // Check if we actually added new tools
              const toolCountAfter = Object.keys(tools).length;
              if (toolCountAfter === toolCountBefore) {
                logger.info('No new tools were added, stopping dependency analysis');
                hasNewDependencies = false;
              }
              
            } catch (error) {
              logger.info(`Error fetching dependency tools: ${error}`);
              hasNewDependencies = false;
            }
          }
        } else {
          logger.info(`No missing dependencies found in iteration ${dependencyIteration}, proceeding with execution`);
          hasNewDependencies = false;
        }
      }
      
      if (dependencyIteration >= MAX_DEPENDENCY_ITERATIONS) {
        logger.info(`Reached maximum dependency iterations (${MAX_DEPENDENCY_ITERATIONS}), proceeding with current tools`);
      }
      
      logger.info(`Dependency analysis completed after ${dependencyIteration} iterations with ${Object.keys(tools).length} total tools`);
      
      // Use the last dependency result for the rest of the logic
      const dependencyResult = finalDependencyResult || { hasDependencies: false, useCase: '', relevantExecutions: [] };

      // Combine the dependency use case BEFORE the original use case
      let finalUseCase = useCase;
      if (dependencyResult?.hasDependencies && dependencyResult.useCase) {
        finalUseCase = `${dependencyResult.useCase}. Then, ${useCase}`;
        logger.info(`Combined use case: ${finalUseCase}`);
      }

      // Use only relevant executions for the final prompt
      const relevantExecutions = dependencyResult?.relevantExecutions || [];
      
      logger.info(`[FilteredExecutions] Using ${relevantExecutions.length} relevant executions out of ${previousExecutions.length} total`);
      if (relevantExecutions.length > 0) {
        logger.info('[FilteredExecutions] Relevant executions:', JSON.stringify(relevantExecutions, null, 2));
      }
      
      const prompt = contextualPrompt({
        userRequest: finalUseCase,
        conversationContext,
        agentResponseStyle: agentResponseStyle,
        previousExecutions: relevantExecutions,
      });

      // Log the final prompt
      logger.info('Final contextual prompt:', prompt);

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
      
      // Store the execution results if we have tool results
      if (isModelToolResponse(response) && response.toolResults && resultsProvider && selectedToolkit) {
        const allResults = response.toolResults
          .map((toolResult, index) => {
            // Match with toolCalls to get the tool name
            const toolCall = response.toolCalls?.[index];
            return {
              tool: toolCall?.toolName || `tool_${index}`,
              result: toolResult.result
            };
          });
        
        if (allResults.length > 0) {
          resultsProvider.storeExecution(selectedToolkit, finalUseCase, allResults);
          logger.info(`[StoreResults] Stored ${allResults.length} tool execution results for toolkit: ${selectedToolkit}`);
          logger.info('[StoreResults] Stored results:', JSON.stringify(allResults, null, 2));
        }
      }
      
      // Check if we have a valid response
      if (!responseText || responseText.trim() === '') {
        logger.info('Empty response from tool execution, using fallback');
        sendErrorCallback(
          callback,
          "I executed the requested tools but couldn't generate a proper response. The tools may not be completed successfully."
        );
      } else {
        // We have a proper response from the model
        sendSuccessCallback(callback, responseText);
      }
    } catch (error) {
      logger.info('Error in useComposioToolsAction:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while trying to use the available tools.',
        error
      );
    }
  },

  examples: composioToolsExamples,
};
