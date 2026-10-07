import { extractEntitiesFromChunk } from '@/features/graph-database/services/entityExtractor';
import { general } from '@/features/graph-database/config/schemas/general.schema';
import { governmentPursuit } from '@/features/graph-database/config/schemas/government-pursuit.schema';

jest.mock('@/server/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Factory is imported dynamically inside the extractor; mock the module.
const mockCompletion = jest.fn();
const mockChatCompletionWithTools = jest.fn();
const mockBuildKnowledgeGraphSource = jest.fn();

jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn().mockImplementation(() => ({
    buildKnowledgeGraphSource: mockBuildKnowledgeGraphSource,
  })),
}));

const toolCapableSource = () => ({
  completion: mockCompletion,
  chatCompletionWithTools: mockChatCompletionWithTools,
});

describe('extractEntitiesFromChunk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildKnowledgeGraphSource.mockResolvedValue({
      source: toolCapableSource(),
      model: { externalId: 'kg-model' },
    });
  });

  describe('schema-driven structured path', () => {
    it('uses chatCompletionWithTools (forced) and carries custom properties', async () => {
      mockChatCompletionWithTools.mockResolvedValue({
        type: 'tool_call',
        toolCallId: 't1',
        toolName: 'extract_graph',
        toolInput: {
          entities: [
            {
              text: 'Enterprise IT Support',
              type: 'Opportunity',
              description: 'A government opportunity',
              aliases: ['EITS'],
              context: 'The Enterprise IT Support solicitation',
              confidence: 0.95,
              properties: { solicitationNumber: 'ABC-123', dueDate: '2026-01-01', value: 5000000 },
            },
          ],
          concepts: [],
          relationships: [],
          summary: 'A solicitation summary',
        },
        inputTokensUsed: 10,
        outputTokensUsed: 20,
      });

      const result = await extractEntitiesFromChunk(
        'Enterprise IT Support solicitation text',
        'chunk-1',
        'user-1',
        'doc-1',
        governmentPursuit
      );

      expect(mockChatCompletionWithTools).toHaveBeenCalledTimes(1);
      // forceToolUse === true (4th arg)
      expect(mockChatCompletionWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ model: 'kg-model', temperature: 0.1, topP: 0.5 }),
        true
      );
      expect(mockCompletion).not.toHaveBeenCalled();

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('Opportunity');
      expect(result.entities[0].properties).toEqual({
        solicitationNumber: 'ABC-123',
        dueDate: '2026-01-01',
        value: 5000000,
      });
      expect(result.summary).toBe('A solicitation summary');
    });

    it('sends the system prompt + user chunk as separate messages (cache prefix)', async () => {
      mockChatCompletionWithTools.mockResolvedValue({
        type: 'tool_call',
        toolInput: { entities: [], concepts: [], relationships: [], summary: '' },
        inputTokensUsed: 1,
        outputTokensUsed: 1,
      });

      await extractEntitiesFromChunk('THE CHUNK BODY', 'chunk-1', 'user-1', 'doc-1', general);

      const [messages] = mockChatCompletionWithTools.mock.calls[0];
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).not.toContain('THE CHUNK BODY');
      expect(messages[1]).toEqual({ role: 'user', content: 'THE CHUNK BODY' });
    });

    it('returns an empty analysis when the tool input fails Zod validation', async () => {
      mockChatCompletionWithTools.mockResolvedValue({
        type: 'tool_call',
        toolInput: { entities: [{ type: 'Opportunity' }], concepts: [], relationships: [], summary: '' },
        inputTokensUsed: 1,
        outputTokensUsed: 1,
      });

      const result = await extractEntitiesFromChunk('text', 'chunk-1', 'user-1', 'doc-1', governmentPursuit);

      expect(result.entities).toEqual([]);
      expect(result.concepts).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.summary).toBe('');
    });

    it('returns an empty analysis when the model returns text instead of a tool call', async () => {
      mockChatCompletionWithTools.mockResolvedValue({
        type: 'text',
        text: 'no tool call here',
        inputTokensUsed: 1,
        outputTokensUsed: 1,
      });

      const result = await extractEntitiesFromChunk('text', 'chunk-1', 'user-1', 'doc-1', general);

      expect(result.entities).toEqual([]);
      expect(result.summary).toBe('');
    });
  });

  describe('legacy path', () => {
    const legacyResponse = JSON.stringify({
      entities: [
        { text: 'John Smith', type: 'PERSON', confidence: 0.9, description: 'A person', aliases: [], context: 'John Smith works here' },
      ],
      concepts: [],
      relationships: [],
      summary: 'legacy summary',
    });

    it('uses the completion path when no schema is provided', async () => {
      mockCompletion.mockResolvedValue({ text: legacyResponse, inputTokensUsed: 1, outputTokensUsed: 1 });

      const result = await extractEntitiesFromChunk('John Smith works here', 'chunk-1', 'user-1', 'doc-1');

      expect(mockCompletion).toHaveBeenCalledTimes(1);
      expect(mockChatCompletionWithTools).not.toHaveBeenCalled();
      expect(result.entities[0].text).toBe('John Smith');
      expect(result.summary).toBe('legacy summary');
    });

    it('falls back to the completion path when the provider lacks tool calling', async () => {
      mockBuildKnowledgeGraphSource.mockResolvedValue({
        source: { completion: mockCompletion }, // no chatCompletionWithTools
        model: { externalId: 'kg-model' },
      });
      mockCompletion.mockResolvedValue({ text: legacyResponse, inputTokensUsed: 1, outputTokensUsed: 1 });

      const result = await extractEntitiesFromChunk('John Smith works here', 'chunk-1', 'user-1', 'doc-1', general);

      expect(mockCompletion).toHaveBeenCalledTimes(1);
      expect(result.entities[0].text).toBe('John Smith');
    });
  });
});
