import { classifyQuery, QueryType } from './queryRouter';
import { AIFactory } from '@/features/ai-provider/factory';

jest.mock('@/features/ai-provider/factory');

jest.mock('@/features/shared/dal/getSystemConfig', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ knowledgeGraphAiProviderModelId: 'model-1' }),
}));

jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(new Set(['doc-1', 'doc-2'])),
}));

jest.mock('@/features/graph-database/dal/getGraphSchema', () => ({
  getGraphSchema: jest.fn().mockResolvedValue(`
Node Types:
- Entity: {name, type, description}
- Concept: {name, category, description}

Relationships:
- (Entity)-[:RELATED]->(Entity)
- (Concept)-[:SIMILAR]->(Concept)
`),
  getScopedGraphSchema: jest.fn().mockResolvedValue(`
Node Types:
- Entity: {name, type, description}
- Concept: {name, category, description}

Relationships:
- (Entity)-[:RELATED]->(Entity)
- (Concept)-[:SIMILAR]->(Concept)
`),
}));

jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('queryRouter', () => {
  const mockUserId = 'user-123';
  const mockChatCompletion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (AIFactory as jest.Mock).mockImplementation(() => ({
      buildKnowledgeGraphSource: jest.fn().mockResolvedValue({
        source: { chatCompletion: mockChatCompletion },
        model: { externalId: 'test-model' },
      }),
    }));
  });

  describe('classifyQuery - single type scenarios', () => {
    it('classifies enumeration queries correctly', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.95, aggregation: 0.1, explanation: 0.1 }),
      });

      const result = await classifyQuery('List all entities', mockUserId);

      expect(result.primaryType).toBe('enumeration');
      expect(result.activeTypes).toEqual(['enumeration']);
      expect(result.confidences.enumeration).toBe(0.95);
    });

    it('classifies aggregation queries correctly', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.2, aggregation: 0.9, explanation: 0.1 }),
      });

      const result = await classifyQuery('How many entities?', mockUserId);

      expect(result.primaryType).toBe('aggregation');
      expect(result.activeTypes).toEqual(['aggregation']);
      expect(result.confidences.aggregation).toBe(0.9);
    });

    it('classifies explanation queries correctly', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.1, aggregation: 0.0, explanation: 0.85 }),
      });

      const result = await classifyQuery('What is PEO DHMS?', mockUserId);

      expect(result.primaryType).toBe('explanation');
      expect(result.activeTypes).toEqual(['explanation']);
      expect(result.confidences.explanation).toBe(0.85);
    });
  });

  describe('classifyQuery - multi-type scenarios', () => {
    it('returns multiple active types when both pass threshold', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.8, aggregation: 0.3, explanation: 0.85 }),
      });

      const result = await classifyQuery('What do these documents have in common?', mockUserId);

      expect(result.activeTypes).toContain('enumeration');
      expect(result.activeTypes).toContain('explanation');
      expect(result.activeTypes).not.toContain('aggregation');
      expect(result.primaryType).toBe('explanation'); // highest confidence
    });

    it('returns all three types when all pass threshold', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.75, aggregation: 0.8, explanation: 0.9 }),
      });

      const result = await classifyQuery('Complex query', mockUserId);

      expect(result.activeTypes).toHaveLength(3);
      expect(result.activeTypes).toContain('enumeration');
      expect(result.activeTypes).toContain('aggregation');
      expect(result.activeTypes).toContain('explanation');
      expect(result.primaryType).toBe('explanation'); // highest confidence
    });

    it('selects primaryType as highest confidence among active types', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.95, aggregation: 0.75, explanation: 0.8 }),
      });

      const result = await classifyQuery('List and count entities', mockUserId);

      expect(result.primaryType).toBe('enumeration'); // 0.95 is highest
      expect(result.activeTypes).toContain('enumeration');
      expect(result.activeTypes).toContain('aggregation');
      expect(result.activeTypes).toContain('explanation');
    });
  });

  describe('classifyQuery - fallback scenarios', () => {
    it('falls back to explanation when no types pass threshold', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.5, aggregation: 0.3, explanation: 0.6 }),
      });

      const result = await classifyQuery('Ambiguous query', mockUserId);

      expect(result.primaryType).toBe('explanation');
      expect(result.activeTypes).toEqual(['explanation']);
      expect(result.confidences.explanation).toBe(0.6);
    });

    it('falls back to explanation on LLM error', async () => {
      mockChatCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await classifyQuery('List all entities', mockUserId);

      expect(result.primaryType).toBe('explanation');
      expect(result.activeTypes).toEqual(['explanation']);
      expect(result.confidences.explanation).toBe(1);
    });

    it('falls back to explanation when no knowledge graph AI provider configured', async () => {
      const getSystemConfig = require('@/features/shared/dal/getSystemConfig').default;
      getSystemConfig.mockResolvedValueOnce({ knowledgeGraphAiProviderModelId: null });

      const result = await classifyQuery('List all entities', mockUserId);

      expect(result.primaryType).toBe('explanation');
      expect(result.activeTypes).toEqual(['explanation']);
    });

    it('handles invalid JSON with fallback', async () => {
      mockChatCompletion.mockResolvedValue({
        text: 'This is not valid JSON',
      });

      const result = await classifyQuery('Some query', mockUserId);

      expect(result.primaryType).toBe('explanation');
      expect(result.activeTypes).toEqual(['explanation']);
    });

    it('handles markdown-wrapped JSON response', async () => {
      mockChatCompletion.mockResolvedValue({
        text: '```json\n{"enumeration": 0.9, "aggregation": 0.1, "explanation": 0.2}\n```',
      });

      const result = await classifyQuery('Show me all concepts', mockUserId);

      expect(result.primaryType).toBe('enumeration');
      expect(result.activeTypes).toEqual(['enumeration']);
    });
  });

  describe('classification test matrix', () => {
    // Test matrix for classification accuracy validation
    const testCases: { query: string; expectedPrimary: QueryType; mockConfidences: { enumeration: number; aggregation: number; explanation: number } }[] = [
      // Enumeration queries
      { query: 'List all entities', expectedPrimary: 'enumeration', mockConfidences: { enumeration: 0.95, aggregation: 0.1, explanation: 0.1 } },
      { query: 'What entities are there?', expectedPrimary: 'enumeration', mockConfidences: { enumeration: 0.9, aggregation: 0.2, explanation: 0.2 } },
      { query: 'Show me all concepts', expectedPrimary: 'enumeration', mockConfidences: { enumeration: 0.9, aggregation: 0.1, explanation: 0.15 } },
      { query: 'What people are mentioned?', expectedPrimary: 'enumeration', mockConfidences: { enumeration: 0.85, aggregation: 0.15, explanation: 0.2 } },
      { query: 'What is connected to John?', expectedPrimary: 'enumeration', mockConfidences: { enumeration: 0.9, aggregation: 0.1, explanation: 0.25 } },

      // Aggregation queries
      { query: 'How many entities?', expectedPrimary: 'aggregation', mockConfidences: { enumeration: 0.2, aggregation: 0.95, explanation: 0.1 } },
      { query: 'Count of entities per type', expectedPrimary: 'aggregation', mockConfidences: { enumeration: 0.3, aggregation: 0.9, explanation: 0.1 } },
      { query: 'How many entities and concepts?', expectedPrimary: 'aggregation', mockConfidences: { enumeration: 0.25, aggregation: 0.9, explanation: 0.1 } },
      { query: 'What percentage are shared?', expectedPrimary: 'aggregation', mockConfidences: { enumeration: 0.2, aggregation: 0.85, explanation: 0.15 } },

      // Explanation queries
      { query: 'What is PEO DHMS?', expectedPrimary: 'explanation', mockConfidences: { enumeration: 0.1, aggregation: 0.0, explanation: 0.95 } },
      { query: 'Explain stakeholder engagement', expectedPrimary: 'explanation', mockConfidences: { enumeration: 0.15, aggregation: 0.05, explanation: 0.9 } },
      { query: 'How does acquisition work?', expectedPrimary: 'explanation', mockConfidences: { enumeration: 0.1, aggregation: 0.1, explanation: 0.9 } },
      { query: 'Why is entity X important?', expectedPrimary: 'explanation', mockConfidences: { enumeration: 0.2, aggregation: 0.05, explanation: 0.85 } },

      // Hybrid queries (multiple types pass threshold)
      { query: 'What do these documents have in common?', expectedPrimary: 'explanation', mockConfidences: { enumeration: 0.8, aggregation: 0.3, explanation: 0.85 } },
      { query: 'Who are the stakeholders and what do they do?', expectedPrimary: 'enumeration', mockConfidences: { enumeration: 0.85, aggregation: 0.1, explanation: 0.75 } },
    ];

    test.each(testCases)(
      'classifies "$query" with primary type $expectedPrimary',
      async ({ query, expectedPrimary, mockConfidences }) => {
        mockChatCompletion.mockResolvedValue({
          text: JSON.stringify(mockConfidences),
        });

        const result = await classifyQuery(query, mockUserId);
        expect(result.primaryType).toBe(expectedPrimary);
      }
    );
  });

  describe('confidence threshold behavior', () => {
    it('accepts type at exactly 0.6 confidence', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.6, aggregation: 0.1, explanation: 0.2 }),
      });

      const result = await classifyQuery('List entities', mockUserId);

      expect(result.activeTypes).toContain('enumeration');
      expect(result.primaryType).toBe('enumeration');
    });

    it('rejects type at 0.59 confidence', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.59, aggregation: 0.1, explanation: 0.5 }),
      });

      const result = await classifyQuery('List entities', mockUserId);

      expect(result.activeTypes).not.toContain('enumeration');
      expect(result.primaryType).toBe('explanation'); // fallback
    });

    it('includes multiple types when both pass threshold', async () => {
      mockChatCompletion.mockResolvedValue({
        text: JSON.stringify({ enumeration: 0.6, aggregation: 0.6, explanation: 0.6 }),
      });

      const result = await classifyQuery('Complex query', mockUserId);

      expect(result.activeTypes).toHaveLength(3);
    });
  });

  it('attributes usage to the caller\'s selected user group', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ enumeration: 0.1, aggregation: 0.0, explanation: 0.95 }),
    });

    await classifyQuery('What is PEO DHMS?', mockUserId, [], undefined, 'group-9');

    expect(AIFactory).toHaveBeenCalledWith({ userId: mockUserId, userGroupId: 'group-9' });
  });
});
