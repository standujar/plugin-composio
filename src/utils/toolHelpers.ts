import type { Composio } from '@composio/core';
import { logger } from '@elizaos/core';
import { COMPOSIO_DEFAULTS } from '../constants';

/**
 * Fetches tools for a given query using Composio's semantic search
 */
export async function fetchToolsForQuery(
  composioClient: Composio<any>,
  userId: string,
  query: string,
  limit = COMPOSIO_DEFAULTS.TOOLS_PER_QUERY_LIMIT,
): Promise<Map<string, unknown>> {
  const tools = new Map();

  try {
    const toolsResponse = await composioClient.tools.get(userId, {
      search: query,
      toolkits: [],
      limit: limit,
    });

    // Handle the response format - it's an object with tool IDs as keys
    if (typeof toolsResponse === 'object' && !Array.isArray(toolsResponse)) {
      // Convert the object to an array of tools with their IDs
      for (const [toolId, toolData] of Object.entries(toolsResponse)) {
        const tool = {
          id: toolId,
          ...(toolData as Record<string, unknown>),
        };
        tools.set(toolId, tool);
      }
    } else if (Array.isArray(toolsResponse)) {
      // Handle array format if API changes
      for (const tool of toolsResponse) {
        if (tool?.id) {
          tools.set(tool.id, tool);
        }
      }
    }
  } catch (error) {
    logger.error(`Error fetching tools for query "${query}":`, error);
  }

  return tools;
}

/**
 * Validates and limits queries to prevent excessive API calls
 */
export function validateAndLimitQueries(
  queries: unknown,
  maxQueries = COMPOSIO_DEFAULTS.MAX_QUERIES_PER_REQUEST,
): string[] {
  if (!Array.isArray(queries)) {
    logger.error('Expected queries array but got:', queries);
    throw new Error('Failed to extract queries - expected queries array');
  }

  return queries.slice(0, maxQueries);
}
