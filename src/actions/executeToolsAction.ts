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
import { toolExecutionPrompt, workflowExtractionPrompt, userResponsePrompt, planContextPrompt } from '../templates';
import {
  COMPOSIO_SERVICE_NAME,
  type ComposioSearchToolsResponse,
  type ComposioCreatePlanResponse,
  type ExtractedToolkit,
  type PreparedToolkitGroup,
  type PreviousStepResult,
  type WorkflowExtractionResponse,
  extractResponseText,
  isModelToolResponse,
  getToolNameFromResult,
} from '../types';
import {
  buildConversationContext,
  getAgentResponseStyle,
  groupConsecutiveToolkits,
  initializeComposioService,
  sendErrorCallback,
  sendSuccessCallback,
  ResponseProcessor,
} from '../utils';

export const useComposioToolsAction: Action = {
  name: 'USE_TOOLS',
  similes: [
    'CALL_TOOL',
    'USE_TOOL',
    'CALL_TOOL',
    'EXECUTE_TOOL',
    'RUN_TOOL',
    'INVOKE_TOOL'
  ],
  description: 'Use tools to perform tasks with external integrations',

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
      
      // Get current time from provider if available
      const timeProvider = runtime.providers?.find(p => p.name === 'TIME');
      const timeInfo = timeProvider ? await timeProvider.get(runtime, message, state) : null;
      const currentTime = String(timeInfo?.values?.time || timeInfo?.text || '');

      // Step 2: Extract toolkit and use case from user request
      const workflowResponse = (await runtime.useModel(ModelType.OBJECT_LARGE, {
        prompt: workflowExtractionPrompt({
          connectedApps,
          conversationContext,
          userRequest: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.EXTRACTION_TEMPERATURE,
      })) as WorkflowExtractionResponse;

      const { toolkits, reasoning: extractedReasoning, use_case: extractedUseCase } = workflowResponse;

      if (!toolkits || !Array.isArray(toolkits) || toolkits.length === 0) {
        logger.info('Invalid workflow response format:', JSON.stringify(workflowResponse));
        sendErrorCallback(callback, 'Unable to understand the request. Please be more specific about what you want to do.');
        return;
      }

      // Convert to ExtractedToolkit array
      const extractedToolkits: ExtractedToolkit[] = toolkits.map(t => ({ name: t.name, use_case: t.use_case }));
      logger.debug(`Extracted ${extractedToolkits.length} toolkit operations:`, JSON.stringify(extractedToolkits));
      logger.debug(`Overall use case: ${extractedUseCase}, Reasoning: ${extractedReasoning}`);

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
      logger.debug(`Grouped into ${toolkitGroups.length} execution groups: ${toolkitGroups.map(g => `${g.name} (${g.use_cases.length} use cases)`).join(', ')}`);

      // Get results provider for storing executions
      const resultsProvider = runtime.providers.find((p) => p.name === 'COMPOSIO_RESULTS') as ComposioResultsProvider;

      // Phase 1: Prepare all toolkit groups in parallel
      logger.debug('🚀 Preparing all toolkit groups in parallel...');
      
      const groupPreparations = await Promise.all(
        toolkitGroups.map(async (group) => {
          try {
            logger.debug(`Preparing group: ${group.name} with ${group.use_cases.length} use cases`);
            
            // Search tools for each use case in this group
            const searchPromises = group.use_cases.map(useCase =>
              composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
                userId: effectiveUserId,
                arguments: {
                  use_case: useCase,
                  toolkits: [group.name.toLowerCase()],
                  known_fields: ''
                }
              })
            );
            
            const searchResults = await Promise.all(searchPromises);

            // Collect all main_tool_slugs and metadata from search results
            const allMainToolSlugs = [];
            let searchReasoning = '';
            let timeInfo = null;

            for (const r of searchResults) {
              const result = r as ComposioSearchToolsResponse;
              if (!result?.successful || !result?.data?.main_tool_slugs || result.data.main_tool_slugs.length === 0) {
                throw new Error(`No tools found for ${group.name}`);
              }

              // Collect all slugs
              allMainToolSlugs.push(...result.data.main_tool_slugs);

              // Keep the first reasoning and time_info found
              if (!searchReasoning && result.data.reasoning) {
                searchReasoning = result.data.reasoning;
              }
              if (!timeInfo && result.data.time_info) {
                timeInfo = result.data.time_info;
              }
            }

            // Deduplicate slugs
            const mainToolSlugs = [...new Set(allMainToolSlugs)];
            
            // Get dependency graphs for all tools in this group
            const depGraphPromises = mainToolSlugs.map(slug =>
              composioService.getToolDependencyGraph(slug, effectiveUserId)
            );
            const dependencyGraphs = await Promise.all(depGraphPromises);
            
            // Collect all unique tools needed for this group
            const allToolsToFetch = new Set<string>();
            for (const slug of mainToolSlugs) {
              allToolsToFetch.add(slug);
            }
            for (const graph of dependencyGraphs) {
              const parentTools = graph?.parent_tools || [];
              for (const dep of parentTools) {
                allToolsToFetch.add(dep.tool_name);
              }
            }
            
            // Parallelize: Fetch tools AND create plan at the same time
            const [tools, planResult] = await Promise.all([
              // Fetch all tools with VercelProvider wrapping (includes Zod schemas)
              composioClient.tools.get(effectiveUserId, {
                tools: Array.from(allToolsToFetch)
              }),

              composioClient.tools.execute('COMPOSIO_CREATE_PLAN', {
                userId: effectiveUserId,
                arguments: {
                  difficulty: 'medium',
                  known_fields: '',
                  primary_tool_slugs: Array.from(allToolsToFetch),
                  reasoning: extractedReasoning,
                  use_case: extractedUseCase
                }
              })
            ]);

            const planResponse = planResult as ComposioCreatePlanResponse;
            const workflowPlan = planResponse?.data?.workflow_instructions?.plan || null;

            // Log the workflow plan details
            if (workflowPlan) {
              logger.debug(`📋 Workflow plan created for ${group.name}:`);
              if (workflowPlan.workflow_steps?.length > 0) {
                logger.debug(`  Steps: ${workflowPlan.workflow_steps.map(s => s.name).join(' → ')}`);
              }
              if (workflowPlan.critical_instructions) {
                logger.debug(`  Critical: ${workflowPlan.critical_instructions.substring(0, 100)}...`);
              }
            } else {
              logger.debug(`⚠️ No workflow plan generated for ${group.name}`);
            }

            logger.debug(`✅ Group ${group.name} prepared with ${allToolsToFetch.size} tools${workflowPlan ? ' and workflow plan' : ''}`);

            return {
              ...group,
              tools,
              dependencyGraphs,
              workflowPlan,
              searchMetadata: {
                reasoning: searchReasoning,
                timeInfo
              }
            } as PreparedToolkitGroup;
            
          } catch (error) {
            logger.error(`❌ Failed to prepare group ${group.name}:`, error);
            throw error;
          }
        })
      );
      
      logger.debug(`✅ All ${groupPreparations.length} groups prepared successfully`);

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
          logger.debug(`[PreviousExecutions] Found ${previousExecutions.length} previous executions for ${preparedGroup.name} (entity: ${effectiveUserId})`);
          
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
            currentTime,
            workflowPlan: preparedGroup.workflowPlan,
          });
          
          logger.debug(`Executing LLM for ${preparedGroup.name} with ${Object.keys(preparedGroup.tools).length} tools`);

          // Use the original tools without modification
          const tools = preparedGroup.tools;

          const response = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt,
            tools,
            toolChoice: 'auto',
            temperature: COMPOSIO_DEFAULTS.EXECUTION_TEMPERATURE,
          });
          
          // Extract response
          let responseText = '';
          if (isModelToolResponse(response) && response.text) {
            responseText = response.text;
          } else {
            responseText = extractResponseText(response);
          }
          
          logger.debug(`Response text for ${preparedGroup.name}: ${responseText.substring(0, 200)}...`);

          // Log tool results if available
          if (isModelToolResponse(response) && response.toolResults) {
            const toolResultsSummary = response.toolResults.map(r => ({
              success: r.result && typeof r.result === 'object' && 'successful' in r.result ? r.result.successful : undefined,
              tool: getToolNameFromResult(r, response.toolCalls),
              resultKeys: Object.keys(r.result || {})
            }));
            logger.debug(`Tool results for ${preparedGroup.name}:`, JSON.stringify(toolResultsSummary, null, 2));
          }
          
          // Extract tool results once and use for both storage and next steps
          const allToolResults = ResponseProcessor.extractToolResultsFromSteps(response);
          const successfulToolResults = ResponseProcessor.filterSuccessfulResults(allToolResults);

          // Store successful results
          if (isModelToolResponse(response) && resultsProvider && successfulToolResults.length > 0) {
            const successfulResults = successfulToolResults.map((toolResult) => ({
              tool: getToolNameFromResult(toolResult, response.toolCalls || []),
              result: toolResult.result,
            }));

            const combinedUseCase = preparedGroup.use_cases.join(', then ');
            logger.debug(`[StoreResults] Storing: ${JSON.stringify(successfulResults.map(r => ({ tool: r.tool, keys: Object.keys(r.result || {}), successful: r.result?.successful })))}`);
            resultsProvider.storeExecution(effectiveUserId, preparedGroup.name, combinedUseCase, successfulResults);
            logger.info(`[StoreResults] Stored ${successfulResults.length} results from steps for ${preparedGroup.name} (entity: ${effectiveUserId})`);
          }

          // Capture results for next steps
          const currentStepResult: PreviousStepResult = {
            groupName: preparedGroup.name,
            useCase: preparedGroup.use_cases.join(', then '),
            responseText,
          };

          // Add tool results from steps if available
          if (successfulToolResults.length > 0) {
            currentStepResult.toolResults = successfulToolResults.map(tr => ({
              tool: getToolNameFromResult(tr, isModelToolResponse(response) ? response.toolCalls || [] : []),
              result: tr.result,
            }));
          }

          previousStepResults.push(currentStepResult);
          logger.debug(`[CaptureResults] Captured results for ${preparedGroup.name} - total steps: ${previousStepResults.length}`);

          // Prepare the response message
          const baseResponse = responseText || `Completed ${preparedGroup.name} operations: ${preparedGroup.use_cases.join(', ')}`;
          
          // If not the last group, generate a progress transition message
          if (i < groupPreparations.length - 1) {
            const nextGroup = groupPreparations[i + 1];
            
            const progressResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
              prompt: userResponsePrompt({
                action: 'progress',
                data: {
                  currentStepIndex: i,
                  totalSteps: groupPreparations.length,
                  currentGroup: preparedGroup.name,
                  currentUseCase: preparedGroup.use_cases.join(', '),
                  nextGroup: nextGroup.name,
                  nextUseCase: nextGroup.use_cases.join(', '),
                  completedResponse: baseResponse,
                },
                userMessage: message.content.text,
              }),
              temperature: COMPOSIO_DEFAULTS.RESPONSE_TEMPERATURE,
            });
            
            const progressText = extractResponseText(progressResponse);
            sendSuccessCallback(callback, progressText);
          } else {
            // Last group - send the final response directly
            sendSuccessCallback(callback, baseResponse);
          }
          
          logger.debug(`✅ Group ${i+1} completed: ${preparedGroup.name}`);
          
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
