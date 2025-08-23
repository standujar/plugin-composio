import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from '@elizaos/core';
import {
  COMPOSIO_SERVICE_NAME,
} from '../types';
import type { ComposioService } from '../services';
import { 
  sendErrorCallback,
  sendSuccessCallback,
  initializeComposioService,
} from '../utils';
import { toolkitExtractionPrompt, toolkitRemovalResponsePrompt } from '../templates';
import { COMPOSIO_DEFAULTS } from '../config/defaults';

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
      logger.info(`[RemoveComposioToolkit] Multi-user mode: ${composioService.isMultiUserMode()}, effective userId: ${effectiveUserId}`);
      
      // Extract toolkit name from user message using model
      const extractionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: toolkitExtractionPrompt({
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_EXTRACTION_TEMPERATURE,
      });

      const { toolkit, confidence } = extractionResponse as { toolkit: string; confidence: string };
      
      if (!toolkit || confidence === 'low') {
        sendErrorCallback(callback, 'Please specify which toolkit/app you want to disconnect (e.g., "remove Gmail", "disconnect Slack")');
        return;
      }

      logger.info(`User wants to remove toolkit: ${toolkit}`);

      // Get ALL connections for this toolkit and user (not just ACTIVE ones)
      const connectedAppsResponse = await composioService.getComposioClient()?.connectedAccounts.list({
        userIds: [effectiveUserId],
        toolkitSlugs: [toolkit.toLowerCase()]
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
      let errors: Error[] = [];
      
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
        logger.warn(`Found ${existingConnections.length} connections for ${toolkit} - there should normally be only 1 per user`);
      }

      // Format response using the model
      const formattedResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: toolkitRemovalResponsePrompt({
          toolkit,
          deletedCount,
          totalConnections: existingConnections.length,
          errorsCount: errors.length,
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_REMOVAL_RESPONSE_TEMPERATURE,
      });

      const responseText = typeof formattedResponse === 'string' ? formattedResponse : (formattedResponse as any)?.text || `Successfully removed ${deletedCount} ${toolkit} connection(s).`;

      if (deletedCount > 0) {
        sendSuccessCallback(callback, responseText);
      } else {
        sendErrorCallback(callback, `Failed to remove ${toolkit} connections. Please try again.`);
      }
      
    } catch (error) {
      logger.error('Error in removeComposioToolkitAction:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while trying to remove the toolkit.',
        error
      );
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Remove Gmail from my account",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll disconnect Gmail from your account.",
          actions: ["REMOVE_COMPOSIO_TOOLKIT"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Disconnect Slack please",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "Let me remove the Slack integration for you.",
          actions: ["REMOVE_COMPOSIO_TOOLKIT"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Uninstall GitHub toolkit",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll remove the GitHub toolkit from your account.",
          actions: ["REMOVE_COMPOSIO_TOOLKIT"],
        },
      },
    ],
  ],
};