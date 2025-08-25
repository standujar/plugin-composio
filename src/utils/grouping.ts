import type { ExtractedToolkit, ToolkitGroup } from '../types/api';

/**
 * Groups consecutive toolkits with the same name into execution groups
 * @param toolkits Array of extracted toolkits in execution order
 * @returns Array of grouped toolkits for optimized execution
 */
export function groupConsecutiveToolkits(toolkits: ExtractedToolkit[]): ToolkitGroup[] {
  if (!toolkits || toolkits.length === 0) {
    return [];
  }

  const groups: ToolkitGroup[] = [];
  let currentGroup: ToolkitGroup | null = null;

  for (const toolkit of toolkits) {
    // If this is the first toolkit or different from current group, start new group
    if (!currentGroup || currentGroup.name !== toolkit.name) {
      // Save previous group if exists
      if (currentGroup) {
        groups.push(currentGroup);
      }
      
      // Start new group
      currentGroup = {
        name: toolkit.name,
        use_cases: [toolkit.use_case]
      };
    } else {
      // Same toolkit as current group, add use case
      currentGroup.use_cases.push(toolkit.use_case);
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}