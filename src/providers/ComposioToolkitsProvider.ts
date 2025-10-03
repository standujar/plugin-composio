import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';
import { logger } from '@elizaos/core';
import type { ToolkitMapping } from '../types';

/**
 * Provider for caching and resolving toolkit names
 * Learns from user interactions to improve toolkit name resolution
 */
export class ComposioToolkitsProvider implements Provider {
  name = 'COMPOSIO_TOOLKITS';
  description = 'Caches toolkit name mappings and learns from user interactions to improve toolkit resolution';

  // Map of normalized search terms to toolkit mappings
  private toolkitMappings: Map<string, ToolkitMapping> = new Map();
  
  // Set of all known valid toolkit names from Composio
  private availableToolkits: Set<string> = new Set();
  
  // Last time the available toolkits were updated
  private lastUpdated: number = 0;

  /**
   * Get all toolkit mappings for context
   */
  async get(
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<{ text: string; data: { mappings: ToolkitMapping[], availableToolkits: string[] } }> {
    const mappings = Array.from(this.toolkitMappings.values());
    const toolkits = Array.from(this.availableToolkits);
    
    return {
      text: `${mappings.length} toolkit mappings cached, ${toolkits.length} toolkits available`,
      data: { 
        mappings: mappings.slice(-10), // Return last 10 mappings
        availableToolkits: toolkits
      },
    };
  }

  /**
   * Normalize a search term for fuzzy matching
   */
  private normalizeSearchTerm(term: string): string {
    return term.toLowerCase().replace(/[-_\s]+/g, '');
  }

  /**
   * Find a toolkit mapping by search term (with fuzzy matching)
   */
  getMapping(searchTerm: string): ToolkitMapping | null {
    // Try exact match first
    const exactMatch = this.toolkitMappings.get(searchTerm.toLowerCase());
    if (exactMatch) {
      logger.info(`[ComposioToolkitsProvider] Exact match found for "${searchTerm}": ${exactMatch.resolvedToolkit}`);
      exactMatch.usageCount++;
      exactMatch.lastUsed = Date.now();
      return exactMatch;
    }

    // Try normalized fuzzy match
    const normalized = this.normalizeSearchTerm(searchTerm);
    for (const [key, mapping] of this.toolkitMappings) {
      if (this.normalizeSearchTerm(key) === normalized) {
        logger.info(`[ComposioToolkitsProvider] Fuzzy match found for "${searchTerm}": ${mapping.resolvedToolkit}`);
        mapping.usageCount++;
        mapping.lastUsed = Date.now();
        
        // Also store this variation for future exact matches
        this.storeMapping({
          ...mapping,
          searchTerm: searchTerm.toLowerCase(),
          usageCount: 1,
        });
        
        return mapping;
      }
    }

    logger.info(`[ComposioToolkitsProvider] No cached mapping found for "${searchTerm}"`);
    return null;
  }

  /**
   * Store a new toolkit mapping
   */
  storeMapping(mapping: ToolkitMapping): void {
    const key = mapping.searchTerm.toLowerCase();
    
    // Check if we already have this mapping
    const existing = this.toolkitMappings.get(key);
    if (existing && existing.resolvedToolkit === mapping.resolvedToolkit) {
      // Update existing mapping
      existing.usageCount++;
      existing.lastUsed = Date.now();
      if (mapping.confidence === 'high' && existing.confidence !== 'high') {
        existing.confidence = 'high';
      }
      logger.info(`[ComposioToolkitsProvider] Updated existing mapping for "${key}": usage count = ${existing.usageCount}`);
    } else {
      // Store new mapping
      this.toolkitMappings.set(key, {
        ...mapping,
        searchTerm: key,
        lastUsed: Date.now(),
      });
      logger.info(`[ComposioToolkitsProvider] Stored new mapping: "${key}" -> "${mapping.resolvedToolkit}"`);
    }

    // Store common variations
    const variations = this.generateVariations(mapping.searchTerm);
    for (const variation of variations) {
      if (!this.toolkitMappings.has(variation)) {
        this.toolkitMappings.set(variation, {
          ...mapping,
          searchTerm: variation,
          usageCount: 0, // Variation starts with 0 usage
        });
      }
    }
  }

  /**
   * Generate common variations of a search term
   */
  private generateVariations(searchTerm: string): string[] {
    const variations: string[] = [];
    const term = searchTerm.toLowerCase();
    
    // Replace underscores with spaces and vice versa
    if (term.includes('_')) {
      variations.push(term.replace(/_/g, ' '));
      variations.push(term.replace(/_/g, '-'));
    }
    if (term.includes(' ')) {
      variations.push(term.replace(/ /g, '_'));
      variations.push(term.replace(/ /g, '-'));
    }
    if (term.includes('-')) {
      variations.push(term.replace(/-/g, '_'));
      variations.push(term.replace(/-/g, ' '));
    }
    
    // Remove all separators
    const noSeparators = term.replace(/[-_\s]/g, '');
    if (noSeparators !== term) {
      variations.push(noSeparators);
    }
    
    return variations;
  }

  /**
   * Update the list of available toolkits
   */
  updateAvailableToolkits(toolkits: string[]): void {
    for (const toolkit of toolkits) {
      this.availableToolkits.add(toolkit.toLowerCase());
    }
    this.lastUpdated = Date.now();
    logger.info(`[ComposioToolkitsProvider] Updated available toolkits: ${toolkits.length} toolkits`);
  }

  /**
   * Get all available toolkits
   */
  getAvailableToolkits(): string[] {
    return Array.from(this.availableToolkits);
  }

  /**
   * Clean up old or rarely used mappings
   */
  cleanOldMappings(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge;
    let removed = 0;
    
    for (const [key, mapping] of this.toolkitMappings) {
      // Keep high-confidence mappings and frequently used ones
      if (mapping.confidence === 'high' || mapping.usageCount >= 3) {
        continue;
      }
      
      // Remove old, low-usage mappings
      if (mapping.lastUsed < cutoffTime && mapping.usageCount < 2) {
        this.toolkitMappings.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info(`[ComposioToolkitsProvider] Cleaned up ${removed} old mappings`);
    }
  }

  /**
   * Get statistics about the cache
   */
  getStats(): { totalMappings: number; uniqueToolkits: number; avgUsageCount: number } {
    const uniqueToolkits = new Set<string>();
    let totalUsage = 0;
    
    for (const mapping of this.toolkitMappings.values()) {
      uniqueToolkits.add(mapping.resolvedToolkit);
      totalUsage += mapping.usageCount;
    }
    
    return {
      totalMappings: this.toolkitMappings.size,
      uniqueToolkits: uniqueToolkits.size,
      avgUsageCount: this.toolkitMappings.size > 0 ? totalUsage / this.toolkitMappings.size : 0,
    };
  }

  /**
   * Clear all mappings (useful for testing)
   */
  clearAll(): void {
    this.toolkitMappings.clear();
    this.availableToolkits.clear();
    this.lastUpdated = 0;
    logger.info('[ComposioToolkitsProvider] Cleared all mappings and toolkits');
  }
}

// Export singleton instance
export const composioToolkitsProvider = new ComposioToolkitsProvider();