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
} from '../utils';

export const listConnectedAppsAction: Action = {
  name: 'LIST_CONNECTED_APPS',
  similes: [
    'LIST_COMPOSIO_APPS',
    'SHOW_CONNECTED_APPS',
    'GET_CONNECTED_APPS',
    'CONNECTED_APPS',
    'COMPOSIO_APPS',
    'MY_APPS',
    'AVAILABLE_APPS',
    'CONNECTED_SERVICES',
    'LIST_INTEGRATIONS',
  ],
  description: 'List all connected apps and integrations available in Composio',

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
      logger.info(`[ListConnectedApps] Multi-user mode: ${composioService.isMultiUserMode()}, effective userId: ${effectiveUserId}`);
      const connectedApps = await composioService.getConnectedApps(effectiveUserId);
      
      if (connectedApps.length === 0) {
        sendSuccessCallback(callback, 'No apps are currently connected.');
        return;
      }
      
      // Use the model to format the response naturally
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: `The user asked about their connected apps. Here are the connected apps: ${connectedApps.join(', ')}. Provide a brief, natural response listing these apps.`,
        temperature: 0.7,
      });
      
      const responseText = typeof response === 'string' ? response : (response as any)?.text || connectedApps.join(', ');
      
      sendSuccessCallback(callback, responseText);
      
    } catch (error) {
      logger.error('Error retrieving connected apps:', error);
      sendErrorCallback(
        callback,
        'Sorry, I encountered an error while retrieving your connected apps. Please try again later.',
        error
      );
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "What apps do I have connected?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "Let me check your connected apps for you.",
          actions: ["LIST_CONNECTED_APPS"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "linear, github, slack",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Show me my connected integrations",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll retrieve your connected integrations from Composio.",
          actions: ["LIST_CONNECTED_APPS"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "List available apps",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "Let me show you all your available connected apps.",
          actions: ["LIST_CONNECTED_APPS"],
        },
      },
    ],
  ],
};