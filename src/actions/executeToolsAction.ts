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
  type ExtractedToolkit,
  type PreparedToolkitGroup,
  type PreviousStepResult,
  type WorkflowExtractionResponse,
  extractResponseText,
  isModelToolResponse,
} from '../types';
import {
  buildConversationContext,
  getAgentResponseStyle,
  groupConsecutiveToolkits,
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

      // Build conversation context and get agent style once
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

      const { toolkits } = workflowResponse;

      if (!toolkits || !Array.isArray(toolkits) || toolkits.length === 0) {
        logger.info('Invalid workflow response format:', JSON.stringify(workflowResponse));
        sendErrorCallback(callback, 'Unable to understand the request. Please be more specific about what you want to do.');
        return;
      }

      // Convert to ExtractedToolkit array
      const extractedToolkits: ExtractedToolkit[] = toolkits.map(t => ({ name: t.name, use_case: t.use_case }));
      logger.info(`Extracted ${extractedToolkits.length} toolkit operations:`, JSON.stringify(extractedToolkits));

      // Validate all toolkits are connected
      const invalidToolkits: string[] = [];
      for (const toolkit of extractedToolkits) {
        const isConnected = connectedApps.some(app => app.toLowerCase() === toolkit.name.toLowerCase());
        if (!isConnected) {
          invalidToolkits.push(toolkit.name);
        }
      }

      if (invalidToolkits.length > 0) {
        const errorMsg = `The following apps are not connected: ${invalidToolkits.join(', ')}. Please connect them first in your Composio dashboard.`;
        logger.info(errorMsg);
        sendErrorCallback(callback, errorMsg);
        return;
      }

      // Group consecutive toolkits for optimized execution
      const toolkitGroups = groupConsecutiveToolkits(extractedToolkits);
      logger.info(`Grouped into ${toolkitGroups.length} execution groups: ${toolkitGroups.map(g => `${g.name} (${g.use_cases.length} use cases)`).join(', ')}`);

      // Get results provider for storing executions
      const resultsProvider = runtime.providers.find((p) => p.name === 'COMPOSIO_RESULTS') as ComposioResultsProvider;

      // Phase 1: Prepare all toolkit groups in parallel
      logger.info('🚀 Preparing all toolkit groups in parallel...');
      
      const groupPreparations = await Promise.all(
        toolkitGroups.map(async (group) => {
          try {
            logger.info(`Preparing group: ${group.name} with ${group.use_cases.length} use cases`);
            
            // Search tools for each use case in this group
            const searchPromises = group.use_cases.map(useCase =>
              composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
                userId: effectiveUserId,
                arguments: { use_case: useCase, toolkits: [group.name.toLowerCase()] }
              })
            );
            
            const searchResults = await Promise.all(searchPromises);
            const mainToolSlugs = searchResults.map(r => {
              const result = r as ComposioSearchToolsResponse;
              if (!result?.successful || !result?.data?.results || result.data.results.length === 0) {
                throw new Error(`No tools found for ${group.name}`);
              }
              return result.data.results[0].tool_slug || result.data.results[0].tool;
            });
            
            // Get dependency graphs for all tools in this group
            const depGraphPromises = mainToolSlugs.map(slug =>
              composioService.getToolDependencyGraph(slug, effectiveUserId)
            );
            const dependencyGraphs = await Promise.all(depGraphPromises);
            
            // Collect all unique tools needed for this group
            const allToolsToFetch = new Set<string>();
            mainToolSlugs.forEach(slug => allToolsToFetch.add(slug));
            dependencyGraphs.forEach(graph => {
              const parentTools = graph?.parent_tools || [];
              parentTools.forEach(dep => allToolsToFetch.add(dep.tool_name));
            });
            
            // Fetch all tools for this group
            const tools = await composioClient.tools.get(effectiveUserId, {
              tools: Array.from(allToolsToFetch)
            });
            
            logger.info(`✅ Group ${group.name} prepared with ${allToolsToFetch.size} tools`);
            
            return {
              ...group,
              tools,
              dependencyGraphs
            } as PreparedToolkitGroup;
            
          } catch (error) {
            logger.error(`❌ Failed to prepare group ${group.name}:`, error);
            throw error;
          }
        })
      );
      
      logger.info(`✅ All ${groupPreparations.length} groups prepared successfully`);

      // Phase 2: Execute each group sequentially with callbacks
      logger.info('🔄 Starting sequential execution of prepared groups...');
      
      // Store results from previous steps to pass to next steps
      const previousStepResults: PreviousStepResult[] = [];
      
      for (let i = 0; i < groupPreparations.length; i++) {
        const preparedGroup = groupPreparations[i];
        logger.info(`\n=== Executing Group ${i+1}/${groupPreparations.length}: ${preparedGroup.name} ===`);
        
        try {
          // Get previous executions for this toolkit and entity
          const previousExecutions = resultsProvider?.getToolkitExecutions(effectiveUserId, preparedGroup.name) || [];
          
          // Execute LLM with pre-fetched tools and enhanced context
          const prompt = toolExecutionPrompt({
            userRequest: preparedGroup.use_cases.join(', then '),
            conversationContext,
            agentResponseStyle,
            previousExecutions,
            dependencyGraph: preparedGroup.dependencyGraphs.flatMap(graph => graph?.parent_tools || []),
            originalRequest: message.content.text,
            currentStepIndex: i,
            totalSteps: groupPreparations.length,
            previousStepResults,
          });
          
          logger.info(`Executing LLM for ${preparedGroup.name} with ${Object.keys(preparedGroup.tools).length} tools`);
          
          const response = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt,
            tools: preparedGroup.tools,
            toolChoice: 'auto',
            temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
          });
          
          // Extract response
          let responseText = '';
          if (isModelToolResponse(response) && response.text) {
            responseText = response.text;
          } else {
            responseText = extractResponseText(response);
          }
          
          logger.info(`Response text for ${preparedGroup.name}: ${responseText.substring(0, 200)}...`);
          
          // Log tool results if available
          if (isModelToolResponse(response) && response.toolResults) {
            const toolResultsSummary = response.toolResults.map(r => ({
              success: r.result && typeof r.result === 'object' && 'successful' in r.result ? r.result.successful : undefined,
              tool: r.toolName || 'unknown',
              resultKeys: Object.keys(r.result || {})
            }));
            logger.info(`Tool results for ${preparedGroup.name}:`, JSON.stringify(toolResultsSummary, null, 2));
          }
          
          // Store successful results
          if (isModelToolResponse(response) && response.toolResults && resultsProvider) {
            const successfulResults = response.toolResults
              .map((toolResult, index) => {
                const toolCall = response.toolCalls?.[index];
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
              const combinedUseCase = preparedGroup.use_cases.join(', then ');
              resultsProvider.storeExecution(effectiveUserId, preparedGroup.name, combinedUseCase, successfulResults);
              logger.info(`[StoreResults] Stored ${successfulResults.length} results for ${preparedGroup.name} (entity: ${effectiveUserId})`);
            }
          }
          
          // Capture results for next steps
          const currentStepResult: PreviousStepResult = {
            groupName: preparedGroup.name,
            useCase: preparedGroup.use_cases.join(', then '),
            responseText,
          };

          // Add tool results if available
          if (isModelToolResponse(response) && response.toolResults) {
            currentStepResult.toolResults = response.toolResults
              .filter(tr => tr.result && typeof tr.result === 'object' && 'successful' in tr.result && tr.result.successful)
              .map(tr => ({
                tool: (tr.toolName as string) || 'unknown',
                result: tr.result,
              }));
          }

          previousStepResults.push(currentStepResult);
          logger.info(`[CaptureResults] Captured results for ${preparedGroup.name} - total steps: ${previousStepResults.length}`);

          // Send callback for this group
          const finalResponse = responseText || `Completed ${preparedGroup.name} operations: ${preparedGroup.use_cases.join(', ')}`;
          sendSuccessCallback(callback, `[${preparedGroup.name}] ${finalResponse}`);
          
          logger.info(`✅ Group ${i+1} completed: ${preparedGroup.name}`);
          
        } catch (error) {
          logger.error(`❌ Group ${i+1} failed: ${preparedGroup.name}`, error);
          sendErrorCallback(callback, `Failed to execute ${preparedGroup.name} operations`);
          // Continue with next group even if this one fails
        }
      }
      
      logger.info('🎯 All toolkit groups executed!');
      return; // Exit handler after all groups processed
    } catch (error) {
      logger.error('Error in useComposioToolsAction:', error);
      sendErrorCallback(callback, 'Sorry, I encountered an error while trying to use the available tools.', error);
    }
  },

  examples: executeToolsExamples,
};
