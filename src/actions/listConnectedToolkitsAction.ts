import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  logger,
} from '@elizaos/core';
import { listConnectedToolkitsExamples } from '../examples';
import type { ComposioService } from '../services';
import { connectedToolkitsListResponsePrompt } from '../templates';
import { COMPOSIO_SERVICE_NAME, getModelResponseText } from '../types';
import { sendErrorCallback, sendSuccessCallback } from '../utils';
import { COMPOSIO_DEFAULTS } from '../config/defaults';

export const listConnectedAppsAction: Action = {
  name: 'LIST_CONNECTED_APPS',
  similes: [
    'LIST_COMPOSIO_APPS',
    'SHOW_CONNECTED_APPS',
    'GET_CONNECTED_APPS',
    'CONNECTED_APPS',
    'COMPOSIO_APPS',
    'MY_APPS',
    'MY_CONNECTED_APPS',
    'CONNECTED_SERVICES',
    'MY_INTEGRATIONS',
    'CONNECTED_TOOLKITS',
  ],
  description: 'List all connected apps and integrations available in Composio',
  examples: listConnectedToolkitsExamples,

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
      logger.info('Retrieving connected apps from Composio...');

      // Get the Composio service
      const composioService = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);

      if (!composioService?.isInitialized()) {
        sendErrorCallback(callback, 'Composio service is not initialized. Please check your configuration.');
        return;
      }

      // Get connected apps for the effective user
      // In multi-user mode, use the message sender's userId
      const effectiveUserId = composioService.isMultiUserMode() ? message.entityId : undefined;
      logger.info(
        `[ListConnectedApps] Multi-user mode: ${composioService.isMultiUserMode()}, effective userId: ${effectiveUserId}`,
      );
      const connectedApps = await composioService.getConnectedApps(effectiveUserId);

      if (connectedApps.length === 0) {
        sendSuccessCallback(callback, 'No apps are currently connected.');
        return;
      }

      // Use the model to format the response naturally
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: connectedToolkitsListResponsePrompt({
          connectedApps,
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.CONNECTED_TOOLKITS_LIST_RESPONSE_TEMPERATURE,
      });

      const responseText = getModelResponseText(response, connectedApps.join(', '));

      sendSuccessCallback(callback, responseText);
    } catch (error) {
      logger.error('Error retrieving connected apps:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while retrieving your connected apps. Please try again later.',
        error,
      );
    }
  },
};
