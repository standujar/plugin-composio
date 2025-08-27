import type { HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { COMPOSIO_DEFAULTS } from '../config/defaults';
import type { ComposioService } from '../services';
import { COMPOSIO_SERVICE_NAME } from '../types';

/**
 * Build conversation context from recent messages
 */
export function buildConversationContext(state: State | undefined, message: Memory, runtime: IAgentRuntime): string {
  let conversationContext = '';

  const recentMessages = state?.data?.providers?.RECENT_MESSAGES?.data?.recentMessages || [];

  if (recentMessages.length > 0) {
    // Filter to get only messages in this conversation
    const relevantMessages = recentMessages
      .filter((msg) => {
        // Include messages from this user or from the agent
        return msg.entityId === message.entityId || msg.entityId === runtime.agentId;
      })
      .slice(-10); // Take last 10 messages

    // Group messages into user-agent pairs
    const messagePairs = [];
    for (let i = relevantMessages.length - 1; i >= 0; i--) {
      const msg = relevantMessages[i];
      if (msg.entityId === message.entityId) {
        // User message
        // Look for the next agent response
        const agentResponse = relevantMessages.slice(i + 1).find((m) => m.entityId === runtime.agentId);
        if (agentResponse) {
          messagePairs.unshift({ user: msg, agent: agentResponse });
        }
      }
    }

    // Take only the last N complete exchanges (configurable)
    const recentExchanges = messagePairs.slice(-COMPOSIO_DEFAULTS.RECENT_EXCHANGES_LIMIT);

    if (recentExchanges.length > 0) {
      conversationContext = `Recent conversation:\n${recentExchanges
        .map((pair) => {
          return `User: ${pair.user.content.text}\nAgent: ${pair.agent.content.text}`;
        })
        .join('\n\n')}`;
    }
  }

  return conversationContext;
}

/**
 * Extract agent response style from state
 */
export function getAgentResponseStyle(state: State | undefined): string {
  return (
    state?.data?.providers?.CHARACTER?.values?.messageDirections ||
    state?.values?.messageDirections ||
    state?.values?.directions ||
    ''
  );
}

/**
 * Initialize and validate Composio service
 */
export async function initializeComposioService(runtime: IAgentRuntime): Promise<{
  service: ComposioService;
  client: any;
  userId: string;
}> {
  const service = runtime.getService<ComposioService>(COMPOSIO_SERVICE_NAME);
  if (!service) {
    throw new Error('Composio service not available');
  }

  const client = service.getComposioClient();
  if (!client) {
    throw new Error('Composio client not available');
  }

  const userId = service.getServiceConfig()?.userId || 'default';

  return { service, client, userId };
}

/**
 * Send error callback with consistent format
 */
export function sendErrorCallback(callback: HandlerCallback | undefined, message: string, error?: unknown): void {
  if (!callback) return;

  const errorMessage = error instanceof Error ? error.message : undefined;

  callback({
    text: message,
    content: {
      text: message,
      ...(errorMessage && { error: errorMessage }),
    },
  });
}

/**
 * Send success callback with consistent format
 */
export function sendSuccessCallback(
  callback: HandlerCallback | undefined,
  text: string,
  additionalContent?: Record<string, unknown>,
): void {
  if (!callback) return;

  callback({
    text,
    content: {
      text,
      ...additionalContent,
    },
  });
}
