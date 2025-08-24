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
import { disconnectToolkitExamples } from '../examples';
import type { ComposioService } from '../services';
import { toolkitDisconnectionResponsePrompt, toolkitNameExtractionPrompt } from '../templates';
import { COMPOSIO_SERVICE_NAME, type ToolkitExtractionResponse, getModelResponseText } from '../types';
import { initializeComposioService, sendErrorCallback, sendSuccessCallback } from '../utils';

export const removeComposioToolkitAction: Action = {
  name: 'REMOVE_COMPOSIO_TOOLKIT',
  similes: [
    'DISCONNECT_COMPOSIO_TOOLKIT',
    'REMOVE_TOOLKIT',
    'DISCONNECT_TOOLKIT',
    'DISCONNECT_APP',
    'REMOVE_APP',
    'DISCONNECT_INTEGRATION',
    'REMOVE_INTEGRATION',
    'UNINSTALL_TOOLKIT',
    'DELETE_TOOLKIT',
  ],
  description: 'Remove and disconnect a Composio toolkit/app integration from the user account',
  examples: disconnectToolkitExamples,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const composioService = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);

    // Only available if service is initialized and in multi-user mode
    return !!composioService?.isInitialized() && composioService.isMultiUserMode();
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<void> => {
    try {
      // Initialize Composio service
      const { service: composioService, userId } = await initializeComposioService(runtime);

      // In multi-user mode, use the message sender's userId
      const effectiveUserId = composioService.isMultiUserMode() ? message.entityId : userId;
      logger.info(
        `[RemoveComposioToolkit] Multi-user mode: ${composioService.isMultiUserMode()}, effective userId: ${effectiveUserId}`,
      );

      // Extract toolkit name from user message using model
      const extractionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: toolkitNameExtractionPrompt({
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_REMOVAL_RESPONSE_TEMPERATURE,
      });

      const { toolkit, confidence } = extractionResponse as ToolkitExtractionResponse;

      if (!toolkit || confidence === 'low') {
        sendErrorCallback(
          callback,
          'Please specify which toolkit/app you want to disconnect (e.g., "remove Gmail", "disconnect Slack")',
        );
        return;
      }

      logger.info(`User wants to remove toolkit: ${toolkit}`);

      // Check if toolkit is allowed
      const allowedToolkits = runtime.getSetting('COMPOSIO_ALLOWED_TOOLKITS') as string[] || COMPOSIO_DEFAULTS.ALLOWED_TOOLKITS;
      
      if (allowedToolkits.length > 0 && !allowedToolkits.includes(toolkit.toLowerCase())) {
        sendErrorCallback(
          callback,
          `The ${toolkit} toolkit is not available. Available toolkits: ${allowedToolkits.join(', ')}`,
        );
        return;
      }

      // Get ALL connections for this toolkit and user (not just ACTIVE ones)
      const connectedAppsResponse = await composioService.getComposioClient()?.connectedAccounts.list({
        userIds: [effectiveUserId],
        toolkitSlugs: [toolkit.toLowerCase()],
        // No status filter - get ALL connections (ACTIVE, INITIATED, FAILED, etc.)
      });

      const existingConnections = connectedAppsResponse?.items || [];

      if (existingConnections.length === 0) {
        sendSuccessCallback(callback, `No connections found for ${toolkit}.`);
        return;
      }

      logger.info(`Found ${existingConnections.length} connections for ${toolkit} (should normally be only 1)`);

      // Delete ALL connections for this toolkit (there should normally be only 1)
      let deletedCount = 0;
      const errors: Error[] = [];

      for (const connection of existingConnections) {
        try {
          await composioService.getComposioClient()?.connectedAccounts.delete(connection.id);
          logger.info(`Successfully deleted connection ${connection.id} (status: ${connection.status}) for ${toolkit}`);
          deletedCount++;
        } catch (error) {
          logger.error(`Failed to delete connection ${connection.id}:`, error);
          errors.push(error as Error);
        }
      }

      // Log warning if more than 1 connection was found (shouldn't happen)
      if (existingConnections.length > 1) {
        logger.warn(
          `Found ${existingConnections.length} connections for ${toolkit} - there should normally be only 1 per user`,
        );
      }

      // Format response using the model
      const formattedResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: toolkitDisconnectionResponsePrompt({
          toolkit,
          deletedCount,
          totalConnections: existingConnections.length,
          errorsCount: errors.length,
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_REMOVAL_RESPONSE_TEMPERATURE,
      });

      const responseText = getModelResponseText(
        formattedResponse,
        `Successfully removed ${deletedCount} ${toolkit} connection(s).`,
      );

      if (deletedCount > 0) {
        sendSuccessCallback(callback, responseText);
      } else {
        sendErrorCallback(callback, `Failed to remove ${toolkit} connections. Please try again.`);
      }
    } catch (error) {
      logger.error('Error in removeComposioToolkitAction:', error);
      sendErrorCallback(callback, 'Sorry, I encountered an error while trying to remove the toolkit.', error);
    }
  },
};
