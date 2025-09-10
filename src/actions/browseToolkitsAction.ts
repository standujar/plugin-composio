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
import { browseToolkitsExamples } from '../examples';
import type { ComposioService } from '../services';
import { userResponsePrompt } from '../templates';
import { COMPOSIO_SERVICE_NAME, getModelResponseText } from '../types';
import { sendErrorCallback, sendSuccessCallback } from '../utils';

export const browseToolkitsAction: Action = {
  name: 'BROWSE_COMPOSIO_TOOLKITS',
  similes: [
    'BROWSE_TOOLKITS',
    'FIND_APPS',
    'SEARCH_APPS',
    'DISCOVER_TOOLS',
    'EXPLORE_APPS',
    'FIND_TOOLKIT',
    'SEARCH_TOOLKITS',
    'DISCOVER_APPS',
    'BROWSE_APPS',
    'EXPLORE_TOOLKITS',
    'WHAT_APPS_CAN',
    'SHOW_AVAILABLE_TOOLS',
    'CATALOG_APPS',
    'AVAILABLE_TOOLKITS',
  ],
  description: 'Browse and discover available Composio toolkits by category or functionality',
  examples: browseToolkitsExamples,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const composioService = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);
    return !!composioService?.isInitialized();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<void> => {
    try {
      logger.info('Browsing available Composio toolkits by category...');

      // Get the Composio service
      const composioService = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);

      if (!composioService?.isInitialized()) {
        sendErrorCallback(callback, 'Composio service is not initialized. Please check your configuration.');
        return;
      }

      // For now, we'll browse all toolkits without category filtering
      // TODO: Add category extraction if needed later
      const category = 'all';

      logger.info(`User wants to browse toolkits for category: ${category}`);

      // Check if we have an allowed toolkits list
      const allowedToolkits = runtime.getSetting('COMPOSIO_ALLOWED_TOOLKITS') as string[] || COMPOSIO_DEFAULTS.ALLOWED_TOOLKITS;
      
      let toolkits: string[];
      
      if (allowedToolkits.length > 0) {
        // If we have an allowed list, use only those toolkits instead of API call
        toolkits = allowedToolkits;
        logger.info(`Using allowed toolkits list (${toolkits.length} toolkits) instead of API call: ${toolkits.join(', ')}`);
      } else {
        // Get effective user ID and fetch toolkits from API
        const effectiveUserId = composioService.isMultiUserMode() ? message.entityId : undefined;
        toolkits = await composioService.getToolkitsByCategory(category, effectiveUserId);
        logger.info(`Fetched ${toolkits.length} toolkits from API for category: ${category}`);
      }

      // Format response using template
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: userResponsePrompt({
          action: 'browse',
          data: {
            category,
            toolkits,
            count: toolkits.length,
          },
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.RESPONSE_TEMPERATURE,
      });

      const responseText = getModelResponseText(
        response, 
        toolkits.length > 0 
          ? `Found ${toolkits.length} apps for ${category}: ${toolkits.join(', ')}`
          : `No toolkits found for "${category}"`
      );

      sendSuccessCallback(callback, responseText);
    } catch (error) {
      logger.error('Error browsing toolkits:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while browsing available toolkits. Please try again.',
        error,
      );
    }
  },
};