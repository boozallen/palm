import db from '@/server/db';
import logger from '@/server/logger';

export type ChecklistItem = {
  id: string;
  category: string;
  item: string;
  sortOrder: number;
};

/**
 * Gets all checklist items for a SWEAR agent, grouped by category
 * @param {string} agentId The agent id
 */
export default async function getChecklistItems(agentId: string): Promise<ChecklistItem[]> {
  try {
    const items = await db.agentSwearChecklistItem.findMany({
      where: {
        aiAgentId: agentId,
      },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
      ],
      select: {
        id: true,
        category: true,
        item: true,
        sortOrder: true,
      },
    });

    return items;
  } catch (error) {
    logger.error('Error fetching SWEAR checklist items: ', error);
    throw new Error('Error fetching SWEAR checklist items');
  }
}

/**
 * Formats checklist items into a string for the prompt
 */
export function formatChecklistForPrompt(items: ChecklistItem[]): string {
  if (items.length === 0) {
    return 'No checklist items configured.';
  }

  // Group items by category
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item.item);
    return acc;
  }, {} as Record<string, string[]>);

  // Format as numbered checklist
  const sections: string[] = [];
  const categoryOrder = [
    'Preliminary Information',
    'Probable Cause',
    'Particularity',
    'Service of the Warrant',
    'Administrative and Procedural Concerns',
  ];

  // Sort categories by predefined order, then alphabetically for any others
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) {
      return 1;
    }
    if (indexB === -1) {
      return -1;
    }
    return indexA - indexB;
  });

  sortedCategories.forEach((category, catIndex) => {
    const romanNumeral = ['I', 'II', 'III', 'IV', 'V'][catIndex] || `${catIndex + 1}`;
    const categoryItems = grouped[category];
    const itemsList = categoryItems
      .map((item, index) => `   ${index + 1}. ${item}`)
      .join('\n');
    sections.push(`${romanNumeral}. ${category}\n${itemsList}`);
  });

  return sections.join('\n\n');
}
