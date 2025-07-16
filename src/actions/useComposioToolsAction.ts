import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  logger,
} from '@elizaos/core';
import { composioToolsExamples } from '../examples';
import type { ComposioService } from '../services';
import { contextualPrompt, queryExtractionPrompt } from '../templates';
import { COMPOSIO_SERVICE_NAME, type QueryWithToolkit } from '../types';
import { COMPOSIO_DEFAULTS } from '../constants';

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
    if (!composioService || !composioService.isInitialized()) {
      return false;
    }

    const connectedApps = composioService.getConnectedApps();
    return connectedApps.length > 0;
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

      // Step 1: Get connected apps and their available tools first
      const composioClient = composioService.getComposioClient();
      if (!composioClient) {
        throw new Error('Composio client not available');
      }

      // Get connected apps
      const connectedApps = composioService.getConnectedApps();

      // Get available tools for connected apps
      const userId = composioService.getServiceConfig()?.userId || 'default';

      // Step 2: Extract multiple queries with knowledge of available tools
      const conversationContext = state?.text || '';

      const queriesResponse = await runtime.useModel(ModelType.OBJECT_LARGE, {
        prompt: queryExtractionPrompt({
          connectedApps: connectedApps,
          conversationContext,
          userRequest: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
      });

      // Expected format: [{toolkit: "github", query: "create issue"}, ...]
      // Flexible parsing to handle various response formats
      let extractedQueries: QueryWithToolkit[] = [];

      // Helper to check if object is a valid query
      const isValidQuery = (obj: any): obj is QueryWithToolkit =>
        obj && typeof obj === 'object' && 'toolkit' in obj && 'query' in obj;

      // Try to extract queries from the response
      if (Array.isArray(queriesResponse)) {
        extractedQueries = queriesResponse.filter(isValidQuery);
      } else if (isValidQuery(queriesResponse)) {
        // Single query object
        extractedQueries = [queriesResponse];
      } else if (typeof queriesResponse === 'object' && queriesResponse !== null) {
        // Look for an array in any property
        const arrayValue = Object.values(queriesResponse).find((value) => Array.isArray(value));
        if (arrayValue) {
          extractedQueries = (arrayValue as any[]).filter(isValidQuery);
          const key = Object.keys(queriesResponse).find((k) => queriesResponse[k] === arrayValue);
          logger.debug(`Found queries in '${key}' property`);
        }
      }

      if (extractedQueries.length === 0) {
        logger.error('No valid queries found in response:', queriesResponse);
        return;
      }

      // Limit to maximum queries to avoid too many tool.get calls
      const limitedQueries = extractedQueries.slice(0, COMPOSIO_DEFAULTS.MAX_QUERIES_PER_REQUEST);
      logger.debug(`Extracted queries: ${JSON.stringify(limitedQueries)}`);

      // Step 3: Use V3 semantic search to find relevant tools for each query
      const allTools = new Map(); // Use Map to deduplicate by tool ID
      logger.debug(`Searching for tools for ${limitedQueries.length} queries`);

      for (const queryObj of limitedQueries) {
        try {
          // Check if the toolkit is in our connected apps
          const selectedToolkit = connectedApps.find((app) => app.toLowerCase() === queryObj.toolkit.toLowerCase());

          if (!selectedToolkit) {
            logger.warn(`Toolkit "${queryObj.toolkit}" not in connected apps, skipping query`);
            continue;
          }

          logger.info(`Searching for "${queryObj.query}" in toolkit: ${selectedToolkit}`);

          const toolsResponse = await composioClient.tools.get(userId, {
            search: queryObj.query,
            toolkits: [selectedToolkit.toLowerCase()],
            limit: COMPOSIO_DEFAULTS.TOOLS_PER_QUERY_LIMIT,
          });

          // Handle the response format - it's an object with tool IDs as keys
          if (typeof toolsResponse === 'object' && !Array.isArray(toolsResponse)) {
            // Convert the object to an array of tools with their IDs
            for (const [toolId, toolData] of Object.entries(toolsResponse)) {
              const tool = {
                id: toolId,
                ...(toolData as Record<string, unknown>),
              };
              logger.debug(`Found toolId: ${toolId}`);
              allTools.set(toolId, tool);
            }
          } else if (Array.isArray(toolsResponse)) {
            // Handle array format if API changes
            for (const tool of toolsResponse) {
              if (tool?.id) {
                allTools.set(tool.id, tool);
              }
            }
          }
        } catch (error) {
          logger.error(`Error fetching tools for query "${queryObj.query}":`, error);
        }
      }

      // Convert Map to object format expected by OpenRouter
      const toolsArray = Array.from(allTools.values());
      const tools: Record<string, unknown> = {};

      // Convert array to object with tool IDs as keys
      for (const tool of toolsArray) {
        tools[tool.id] = tool;
      }

      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: contextualPrompt({
          conversationContext,
          userRequest: message.content.text,
        }),
        tools,
        toolChoice: 'auto',
        temperature: COMPOSIO_DEFAULTS.TOOL_EXECUTION_TEMPERATURE,
      });

      // Check if we have a valid response
      if (!response || response.trim() === '') {
        logger.warn('Empty response from tool execution, using fallback');

        if (callback) {
          callback({
            text: "I executed the requested tools but couldn't generate a proper response. The tools completed successfully.",
            content: {
              text: "I executed the requested tools but couldn't generate a proper response. The tools completed successfully.",
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
