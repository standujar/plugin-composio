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
import { userResponsePrompt, toolkitResolutionPrompt } from '../templates';
import { 
  COMPOSIO_SERVICE_NAME, 
  type ToolkitSelectionResponse,
  getModelResponseText 
} from '../types';
import { initializeComposioService, sendErrorCallback, sendSuccessCallback } from '../utils';

export const removeComposioToolkitAction: Action = {
  name: 'DISCONNECT_APPLICATION',
  similes: [
    'DISCONNECT_TOOLKIT',
    'REMOVE_TOOLKIT',
    'DISCONNECT_TOOLKIT',
    'DISCONNECT_APP',
    'REMOVE_APP',
    'DISCONNECT_INTEGRATION',
    'REMOVE_INTEGRATION',
    'UNINSTALL_TOOLKIT',
    'DELETE_TOOLKIT',
  ],
  description: 'Remove and disconnect a toolkit/app integration from the user account',
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

      // Get connected toolkits for the user - this is simpler than connect since we know what's connected
      const connectedToolkits = await composioService.getConnectedApps(effectiveUserId);
      
      logger.info(`User has ${connectedToolkits.length} connected toolkits: ${connectedToolkits.join(', ')}`);

      let resolvedToolkit: string = '';
      let deletedCount = 0;
      const errors: Error[] = [];
      
      // Only try to select and disconnect if there are connected apps
      if (connectedToolkits.length === 0) {
        logger.info('No connected toolkits found, skipping selection and deletion');
      } else {
        // Always use the connected toolkits list for selection since we know what's available
        logger.info(`[Connected List Mode] Using direct selection from ${connectedToolkits.length} connected toolkits`);
        
        const selectionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
          prompt: toolkitResolutionPrompt({
            userMessage: message.content.text,
            availableToolkits: connectedToolkits,
            mode: 'extract_and_select',
          }),
          temperature: COMPOSIO_DEFAULTS.EXTRACTION_TEMPERATURE,
        });

        const { selectedToolkit, confidence } = selectionResponse as ToolkitSelectionResponse;
        
        if (!selectedToolkit || confidence === 'low') {
          sendErrorCallback(
            callback,
            `Could not match your request to any connected toolkit. Connected toolkits: ${connectedToolkits.join(', ')}`,
          );
          return;
        }

        resolvedToolkit = selectedToolkit;
        logger.info(`Selected toolkit from connected list: ${resolvedToolkit} with confidence: ${confidence}`);

        // Get ALL connections for this toolkit and user (not just ACTIVE ones)
        const connectedAppsResponse = await composioService.getComposioClient()?.connectedAccounts.list({
          userIds: [effectiveUserId],
          toolkitSlugs: [resolvedToolkit.toLowerCase()],
          // No status filter - get ALL connections (ACTIVE, INITIATED, FAILED, etc.)
        });

        const existingConnections = connectedAppsResponse?.items || [];

        if (existingConnections.length === 0) {
          logger.info(`No actual connections found for ${resolvedToolkit} in Composio backend`);
        } else {
          logger.info(`Found ${existingConnections.length} connections for ${resolvedToolkit} (should normally be only 1)`);

          // Delete ALL connections for this toolkit (there should normally be only 1)
          for (const connection of existingConnections) {
            try {
              await composioService.getComposioClient()?.connectedAccounts.delete(connection.id);
              logger.info(`Successfully deleted connection ${connection.id} (status: ${connection.status}) for ${resolvedToolkit}`);
              deletedCount++;
            } catch (error) {
              logger.error(`Failed to delete connection ${connection.id}:`, error);
              errors.push(error as Error);
            }
          }

          // Log warning if more than 1 connection was found (shouldn't happen)
          if (existingConnections.length > 1) {
            logger.warn(
              `Found ${existingConnections.length} connections for ${resolvedToolkit} - there should normally be only 1 per user`,
            );
          }
        }
      }

      // Format response using the model - handle all cases
      let statusMessage: string;
      if (connectedToolkits.length === 0) {
        statusMessage = 'No apps were connected to disconnect';
      } else if (deletedCount > 0) {
        statusMessage = `Successfully removed ${deletedCount} connection(s) for ${resolvedToolkit}`;
      } else {
        statusMessage = `No connections found for ${resolvedToolkit} to disconnect`;
      }

      const formattedResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: userResponsePrompt({
          action: 'disconnect',
          data: {
            toolkit: resolvedToolkit || 'none',
            success: deletedCount > 0 || connectedToolkits.length === 0, // Success if we deleted something OR if there was nothing to delete
            message: statusMessage,
          },
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.RESPONSE_TEMPERATURE,
      });

      const responseText = getModelResponseText(formattedResponse, statusMessage);
      sendSuccessCallback(callback, responseText);
    } catch (error) {
      logger.error('Error in removeComposioToolkitAction:', error);
      sendErrorCallback(callback, 'Sorry, I encountered an error while trying to remove the toolkit.', error);
    }
  },
};
