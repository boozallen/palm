import db from '@/server/db';
import getChecklistItems, { formatChecklistForPrompt, ChecklistItem } from './getChecklistItems';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentSwearChecklistItem: {
    findMany: jest.fn(),
  },
}));

describe('getChecklistItems', () => {
  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

  const mockItems = [
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      category: 'Preliminary Information',
      item: 'Have you identified the jurisdiction?',
      sortOrder: 1,
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174002',
      category: 'Probable Cause',
      item: 'Have you indicated the basis of your knowledge?',
      sortOrder: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockResolvedValue(mockItems);
  });

  it('should query checklist items with correct parameters', async () => {
    await getChecklistItems(mockAgentId);

    expect(db.agentSwearChecklistItem.findMany).toHaveBeenCalledWith({
      where: {
        aiAgentId: mockAgentId,
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
  });

  it('should return checklist items', async () => {
    const result = await getChecklistItems(mockAgentId);

    expect(result).toEqual(mockItems);
  });

  it('should return empty array when no items found', async () => {
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getChecklistItems(mockAgentId);

    expect(result).toEqual([]);
  });

  it('should throw an error if query fails', async () => {
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(getChecklistItems(mockAgentId)).rejects.toThrow('Error fetching SWEAR checklist items');
  });

  it('should log an error if query fails', async () => {
    const mockError = new Error('DB error');
    (db.agentSwearChecklistItem.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getChecklistItems(mockAgentId)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error fetching SWEAR checklist items: ', mockError);
  });
});

describe('formatChecklistForPrompt', () => {
  it('should return message when no items', () => {
    const result = formatChecklistForPrompt([]);

    expect(result).toBe('No checklist items configured.');
  });

  it('should format items with Roman numerals for known categories', () => {
    const items: ChecklistItem[] = [
      { id: '1', category: 'Preliminary Information', item: 'Check jurisdiction', sortOrder: 1 },
      { id: '2', category: 'Preliminary Information', item: 'Check caption', sortOrder: 2 },
      { id: '3', category: 'Probable Cause', item: 'Indicate basis', sortOrder: 1 },
    ];

    const result = formatChecklistForPrompt(items);

    expect(result).toContain('I. Preliminary Information');
    expect(result).toContain('II. Probable Cause');
    expect(result).toContain('1. Check jurisdiction');
    expect(result).toContain('2. Check caption');
    expect(result).toContain('1. Indicate basis');
  });

  it('should sort categories by predefined order', () => {
    const items: ChecklistItem[] = [
      { id: '1', category: 'Probable Cause', item: 'Item 1', sortOrder: 1 },
      { id: '2', category: 'Preliminary Information', item: 'Item 2', sortOrder: 1 },
      { id: '3', category: 'Particularity', item: 'Item 3', sortOrder: 1 },
    ];

    const result = formatChecklistForPrompt(items);

    const prelimIndex = result.indexOf('I. Preliminary Information');
    const probableIndex = result.indexOf('II. Probable Cause');
    const particularityIndex = result.indexOf('III. Particularity');

    expect(prelimIndex).toBeLessThan(probableIndex);
    expect(probableIndex).toBeLessThan(particularityIndex);
  });

  it('should handle all five standard categories', () => {
    const items: ChecklistItem[] = [
      { id: '1', category: 'Preliminary Information', item: 'Item 1', sortOrder: 1 },
      { id: '2', category: 'Probable Cause', item: 'Item 2', sortOrder: 1 },
      { id: '3', category: 'Particularity', item: 'Item 3', sortOrder: 1 },
      { id: '4', category: 'Service of the Warrant', item: 'Item 4', sortOrder: 1 },
      { id: '5', category: 'Administrative and Procedural Concerns', item: 'Item 5', sortOrder: 1 },
    ];

    const result = formatChecklistForPrompt(items);

    expect(result).toContain('I. Preliminary Information');
    expect(result).toContain('II. Probable Cause');
    expect(result).toContain('III. Particularity');
    expect(result).toContain('IV. Service of the Warrant');
    expect(result).toContain('V. Administrative and Procedural Concerns');
  });

  it('should handle custom categories with numeric order', () => {
    const items: ChecklistItem[] = [
      { id: '1', category: 'Preliminary Information', item: 'Item 1', sortOrder: 1 },
      { id: '2', category: 'Probable Cause', item: 'Item 2', sortOrder: 1 },
      { id: '3', category: 'Particularity', item: 'Item 3', sortOrder: 1 },
      { id: '4', category: 'Service of the Warrant', item: 'Item 4', sortOrder: 1 },
      { id: '5', category: 'Administrative and Procedural Concerns', item: 'Item 5', sortOrder: 1 },
      { id: '6', category: 'Custom Category', item: 'Item 6', sortOrder: 1 },
    ];

    const result = formatChecklistForPrompt(items);

    expect(result).toContain('6. Custom Category');
  });

  it('should number items within each category starting at 1', () => {
    const items: ChecklistItem[] = [
      { id: '1', category: 'Preliminary Information', item: 'First item', sortOrder: 1 },
      { id: '2', category: 'Preliminary Information', item: 'Second item', sortOrder: 2 },
      { id: '3', category: 'Preliminary Information', item: 'Third item', sortOrder: 3 },
    ];

    const result = formatChecklistForPrompt(items);

    expect(result).toContain('1. First item');
    expect(result).toContain('2. Second item');
    expect(result).toContain('3. Third item');
  });
});
