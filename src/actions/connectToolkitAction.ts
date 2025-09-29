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
import { 
  toolkitResolutionPrompt,
  userResponsePrompt
} from '../templates';
import {
  COMPOSIO_SERVICE_NAME,
  type ComposioInitiateConnectionResponse,
  type ComposioRetrieveToolkitsResponse,
  type ToolkitExtractionResponse,
  type ToolkitSelectionResponse,
  type ToolkitMapping,
  getModelResponseText,
} from '../types';
import { initializeComposioService, sendErrorCallback, sendSuccessCallback } from '../utils';
import { composioToolkitsProvider } from '../providers/ComposioToolkitsProvider';
import { selectToolkitSchema, extractToolkitSchema } from '../types/schemas';

export const addComposioToolkitAction: Action = {
  name: 'CONNECT_APPLICATION',
  similes: [
    'CONNECT_TOOLKIT',
    'ADD_TOOLKIT',
    'CONNECT_TOOLKIT',
    'CONNECT_APP',
    'ADD_APP',
    'CONNECT_INTEGRATION',
    'ADD_INTEGRATION',
    'SETUP_TOOLKIT',
    'INSTALL_TOOLKIT',
  ],
  description: 'Add and connect a new toolkit/app integration for the user',
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

      // Get allowed toolkits configuration
      const allowedToolkits = runtime.getSetting('COMPOSIO_ALLOWED_TOOLKITS') as string[] || COMPOSIO_DEFAULTS.ALLOWED_TOOLKITS;
      const hasAllowedList = allowedToolkits && allowedToolkits.length > 0;

      let resolvedToolkit: string;

      // If we have an allowed list, use single LLM call to extract and match
      if (hasAllowedList) {
        logger.info(`[Allowed List Mode] Using direct selection from ${allowedToolkits.length} allowed toolkits`);
        
        const selectionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
          prompt: toolkitResolutionPrompt({
            userMessage: message.content.text,
            availableToolkits: allowedToolkits,
            mode: 'extract_and_select',
          }),
          schema: selectToolkitSchema,
          temperature: COMPOSIO_DEFAULTS.EXTRACTION_TEMPERATURE,
        });

        const { selectedToolkit, confidence } = selectionResponse as ToolkitSelectionResponse;
        
        if (!selectedToolkit || confidence === 'low') {
          sendErrorCallback(
            callback,
            `Could not match your request to any allowed toolkit. Available options: ${allowedToolkits.join(', ')}`,
          );
          return;
        }

        resolvedToolkit = selectedToolkit;
        logger.info(`Selected toolkit from allowed list: ${resolvedToolkit} with confidence: ${confidence}`);
        
      } else {
        // No allowed list, use standard extraction + cache/retrieve flow
        const extractionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
          prompt: toolkitResolutionPrompt({
            userMessage: message.content.text,
            mode: 'extract',
          }),
          schema: extractToolkitSchema,
          temperature: COMPOSIO_DEFAULTS.EXTRACTION_TEMPERATURE,
        });

        const { toolkit: extractedToolkit, confidence } = extractionResponse as ToolkitExtractionResponse;

        if (!extractedToolkit || confidence === 'low') {
          sendErrorCallback(
            callback,
            'Please specify which toolkit/app you want to connect (e.g., "connect Gmail", "add Slack integration")',
          );
          return;
        }

        logger.info(`User wants to connect toolkit: ${extractedToolkit}`);

        // Check cache first
        const cachedMapping = composioToolkitsProvider.getMapping(extractedToolkit);
        
        if (cachedMapping) {
          logger.info(`[Cache Hit] Found cached mapping: ${extractedToolkit} -> ${cachedMapping.resolvedToolkit}`);
          resolvedToolkit = cachedMapping.resolvedToolkit;
        } else {
          logger.info(`[Cache Miss] No cached mapping for: ${extractedToolkit}, calling COMPOSIO_RETRIEVE_TOOLKITS`);
          
          // Call COMPOSIO_RETRIEVE_TOOLKITS to get available toolkits
          const retrieveResponse = (await composioClient.tools.execute('COMPOSIO_RETRIEVE_TOOLKITS', {
            userId: effectiveUserId,
            arguments: {
              category: extractedToolkit.toLowerCase(),
            },
          })) as ComposioRetrieveToolkitsResponse;

          if (!retrieveResponse?.successful || !retrieveResponse?.data?.apps || retrieveResponse.data.apps.length === 0) {
            sendErrorCallback(
              callback,
              `No toolkits found matching "${extractedToolkit}". Please try a different name or check available toolkits.`,
            );
            return;
          }

          logger.info(`Retrieved ${retrieveResponse.data.apps.length} potential toolkits: ${retrieveResponse.data.apps.join(', ')}`);

          // Use LLM to select the best matching toolkit
          const selectionResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
            prompt: toolkitResolutionPrompt({
              userMessage: message.content.text,
              availableToolkits: retrieveResponse.data.apps,
              mode: 'select',
            }),
            schema: selectToolkitSchema,
            temperature: COMPOSIO_DEFAULTS.EXTRACTION_TEMPERATURE,
          });

          const { selectedToolkit, confidence: selectionConfidence } = selectionResponse as ToolkitSelectionResponse;
          
          if (!selectedToolkit) {
            sendErrorCallback(
              callback,
              `Could not determine the appropriate toolkit for "${extractedToolkit}". Available options: ${retrieveResponse.data.apps.join(', ')}`,
            );
            return;
          }

          resolvedToolkit = selectedToolkit;
          logger.info(`Selected toolkit: ${resolvedToolkit} with confidence: ${selectionConfidence}`);

          // Store the mapping in cache for future use
          const mapping: ToolkitMapping = {
            searchTerm: extractedToolkit.toLowerCase(),
            resolvedToolkit,
            confidence: selectionConfidence,
            lastUsed: Date.now(),
            usageCount: 1,
          };
          composioToolkitsProvider.storeMapping(mapping);
          logger.info(`Stored new mapping in cache: ${extractedToolkit} -> ${resolvedToolkit}`);
        }
      }

      // Check for existing connections
      const connectedAppsResponse = await composioService.getComposioClient()?.connectedAccounts.list({
        userIds: [effectiveUserId],
        toolkitSlugs: [resolvedToolkit.toLowerCase()],
      });

      const existingConnections = connectedAppsResponse?.items || [];

      // Check if there's already an ACTIVE connection
      const activeConnection = existingConnections.find((conn) => conn.status === 'ACTIVE');

      if (activeConnection) {
        logger.info(`User ${effectiveUserId} already has an ACTIVE connection for ${resolvedToolkit}`);
        sendSuccessCallback(callback, `The ${resolvedToolkit} toolkit is already connected and active for your account.`);
        return;
      }

      // Clean up any non-active connections (INITIATED, FAILED, etc.)
      const nonActiveConnections = existingConnections.filter((conn) => conn.status !== 'ACTIVE');

      if (nonActiveConnections.length > 0) {
        logger.info(`Found ${nonActiveConnections.length} non-active connections for ${resolvedToolkit}, cleaning them up`);

        for (const connection of nonActiveConnections) {
          try {
            await composioService.getComposioClient()?.connectedAccounts.delete(connection.id);
            logger.info(`Deleted non-active connection ${connection.id} (status: ${connection.status}) for ${resolvedToolkit}`);
          } catch (error) {
            logger.warn(`Failed to delete connection ${connection.id}:`, error);
          }
        }

        logger.info(`Successfully cleaned up ${nonActiveConnections.length} old non-active connections for ${resolvedToolkit}`);
      } else {
        logger.info(`No non-active connections found for ${resolvedToolkit}`);
      }

      // Use COMPOSIO_INITIATE_CONNECTION tool to create connection
      const connectionResult = (await composioClient.tools.execute('COMPOSIO_INITIATE_CONNECTION', {
        userId: effectiveUserId,
        arguments: {
          toolkit: resolvedToolkit.toLowerCase(),
        },
      })) as ComposioInitiateConnectionResponse;

      if (!connectionResult?.successful || !connectionResult?.data?.response_data) {
        sendErrorCallback(callback, `Failed to initiate connection for ${resolvedToolkit}. Please try again.`);
        return;
      }

      const responseData = connectionResult.data.response_data;

      // Format the response using the model
      const formattedResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: userResponsePrompt({
          action: 'connect',
          data: {
            toolkit: resolvedToolkit,
            status: responseData.status,
            success: responseData.success,
            message: responseData.message,
            redirectUrl: responseData.redirect_url,
            instruction: responseData.instruction,
          },
          userMessage: message.content.text,
        }),
        temperature: COMPOSIO_DEFAULTS.RESPONSE_TEMPERATURE,
      });

      const responseText = getModelResponseText(formattedResponse, responseData.message);

      sendSuccessCallback(callback, responseText);
    } catch (error) {
      logger.error('Error in addComposioToolkitAction:', error);
      sendErrorCallback(callback, 'Sorry, I encountered an error while trying to connect the toolkit.', error);
    }
  },
};
