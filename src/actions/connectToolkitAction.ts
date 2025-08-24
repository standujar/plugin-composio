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
import { connectToolkitExamples } from '../examples';
import type { ComposioService } from '../services';
import { toolkitConnectionResponsePrompt, toolkitNameExtractionPrompt } from '../templates';
import {
  COMPOSIO_SERVICE_NAME,
  type ComposioInitiateConnectionResponse,
  type ComposioSearchToolsResponse,
  type ToolkitExtractionResponse,
  getModelResponseText,
} from '../types';
import { initializeComposioService, sendErrorCallback, sendSuccessCallback } from '../utils';

export const addComposioToolkitAction: Action = {
  name: 'ADD_COMPOSIO_TOOLKIT',
  similes: [
    'CONNECT_COMPOSIO_TOOLKIT',
    'ADD_TOOLKIT',
    'CONNECT_TOOLKIT',
    'CONNECT_APP',
    'ADD_APP',
    'CONNECT_INTEGRATION',
    'ADD_INTEGRATION',
    'SETUP_TOOLKIT',
    'INSTALL_TOOLKIT',
  ],
  description: 'Add and connect a new Composio toolkit/app integration for the user',
  examples: connectToolkitExamples,

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
      const { service: composioService, client: composioClient, userId } = await initializeComposioService(runtime);

      // In multi-user mode, use the message sender's userId
      const effectiveUserId = composioService.isMultiUserMode() ? message.entityId : userId;
      logger.info(
        `[AddComposioToolkit] Multi-user mode: ${composioService.isMultiUserMode()}, effective userId: ${effectiveUserId}`,
      );

      // Extract toolkit name from user message using model
      const extractionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
        prompt: toolkitNameExtractionPrompt({
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_CONNECTION_EXTRACTION_TEMPERATURE,
      });

      const { toolkit, confidence } = extractionResponse as ToolkitExtractionResponse;

      if (!toolkit || confidence === 'low') {
        sendErrorCallback(
          callback,
          'Please specify which toolkit/app you want to connect (e.g., "connect Gmail", "add Slack integration")',
        );
        return;
      }

      logger.info(`User wants to connect toolkit: ${toolkit}`);

      // Check if toolkit is allowed
      const allowedToolkits = runtime.getSetting('COMPOSIO_ALLOWED_TOOLKITS') as string[] || COMPOSIO_DEFAULTS.ALLOWED_TOOLKITS;
      
      if (allowedToolkits.length > 0 && !allowedToolkits.includes(toolkit.toLowerCase())) {
        sendErrorCallback(
          callback,
          `The ${toolkit} toolkit is not available. Available toolkits: ${allowedToolkits.join(', ')}`,
        );
        return;
      }

      // Check if toolkit exists using COMPOSIO_SEARCH_TOOLS
      const searchResult = (await composioClient.tools.execute('COMPOSIO_SEARCH_TOOLS', {
        userId: effectiveUserId,
        arguments: {
          use_case: `Connect ${toolkit}`,
          toolkits: [toolkit.toLowerCase()],
        },
      })) as ComposioSearchToolsResponse;

      if (!searchResult?.successful || !searchResult?.data?.results || searchResult.data.results.length === 0) {
        sendErrorCallback(
          callback,
          `Toolkit "${toolkit}" not found or not available. Please check the toolkit name and try again.`,
        );
        return;
      }

      // Check for existing connections
      const connectedAppsResponse = await composioService.getComposioClient()?.connectedAccounts.list({
        userIds: [effectiveUserId],
        toolkitSlugs: [toolkit.toLowerCase()],
      });

      const existingConnections = connectedAppsResponse?.items || [];

      // Check if there's already an ACTIVE connection
      const activeConnection = existingConnections.find((conn) => conn.status === 'ACTIVE');

      if (activeConnection) {
        logger.info(`User ${effectiveUserId} already has an ACTIVE connection for ${toolkit}`);
        sendSuccessCallback(callback, `The ${toolkit} toolkit is already connected and active for your account.`);
        return;
      }

      // Clean up any non-active connections (INITIATED, FAILED, etc.)
      const nonActiveConnections = existingConnections.filter((conn) => conn.status !== 'ACTIVE');

      if (nonActiveConnections.length > 0) {
        logger.info(`Found ${nonActiveConnections.length} non-active connections for ${toolkit}, cleaning them up`);

        for (const connection of nonActiveConnections) {
          try {
            await composioService.getComposioClient()?.connectedAccounts.delete(connection.id);
            logger.info(`Deleted non-active connection ${connection.id} (status: ${connection.status}) for ${toolkit}`);
          } catch (error) {
            logger.warn(`Failed to delete connection ${connection.id}:`, error);
          }
        }

        logger.info(`Successfully cleaned up ${nonActiveConnections.length} old non-active connections for ${toolkit}`);
      } else {
        logger.info(`No non-active connections found for ${toolkit}`);
      }

      // Use COMPOSIO_INITIATE_CONNECTION tool to create connection
      const connectionResult = (await composioClient.tools.execute('COMPOSIO_INITIATE_CONNECTION', {
        userId: effectiveUserId,
        arguments: {
          toolkit: toolkit.toLowerCase(),
        },
      })) as ComposioInitiateConnectionResponse;

      if (!connectionResult?.successful || !connectionResult?.data?.response_data) {
        sendErrorCallback(callback, `Failed to initiate connection for ${toolkit}. Please try again.`);
        return;
      }

      const responseData = connectionResult.data.response_data;

      // Format the response using the model
      const formattedResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: toolkitConnectionResponsePrompt({
          toolkit,
          status: responseData.status,
          success: responseData.success,
          message: responseData.message,
          redirectUrl: responseData.redirect_url,
          instruction: responseData.instruction,
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.TOOLKIT_CONNECTION_RESPONSE_TEMPERATURE,
      });

      const responseText = getModelResponseText(formattedResponse, responseData.message);

      sendSuccessCallback(callback, responseText);
    } catch (error) {
      logger.error('Error in addComposioToolkitAction:', error);
      sendErrorCallback(callback, 'Sorry, I encountered an error while trying to connect the toolkit.', error);
    }
  },
};
