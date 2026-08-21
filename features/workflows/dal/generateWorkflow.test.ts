import { PrimitiveType } from '@/features/workflows/types/primitive';
import generateWorkflow from '@/features/workflows/dal/generateWorkflow';
import { processDocuments } from '@/features/chat/utils/chatContextHelpers';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import getAvailableModels from '@/features/shared/dal/getAvailableModels';

jest.mock('@/features/chat/utils/chatContextHelpers');
jest.mock('@/features/chat/knowledge-bases/addContextToMessage');
jest.mock('@/features/shared/dal/getAvailableModels');
jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

const mockCompletion = jest.fn();
const mockBuildSystemSource = jest.fn();

const mockAi = {
  buildSystemSource: mockBuildSystemSource,
} as unknown as Parameters<typeof generateWorkflow>[0];

const mockSystemAi = {
  model: { externalId: 'test-model' },
  source: { completion: mockCompletion },
};

const validPrimitives = [
  {
    id: 'doc-1',
    type: PrimitiveType.DOCUMENT,
    name: 'Source Document',
    config: { documentId: 'uuid-1' },
    position: { x: 180, y: 20 },
  },
  {
    id: 'analyze',
    type: PrimitiveType.PROMPT,
    name: 'Analyze Content',
    config: { model: '', prompt: 'Analyze...' },
    position: { x: 180, y: 140 },
    predecessorIds: ['doc-1'],
  },
  {
    id: 'report',
    type: PrimitiveType.ARTIFACT,
    name: 'Report',
    config: { format: '.docx', filename: 'Report' },
    position: { x: 180, y: 260 },
    predecessorIds: ['analyze'],
  },
];

describe('generateWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildSystemSource.mockResolvedValue(mockSystemAi);
    (getAvailableModels as jest.Mock).mockResolvedValue([
      {
        id: 'model-uuid-1',
        aiProviderId: 'provider-1',
        name: 'GPT-4',
        providerLabel: 'OpenAI',
        aiProviderTypeId: 1,
        externalId: 'gpt-4',
        costPerInputToken: 0.001,
        costPerOutputToken: 0.002,
      },
      {
        id: 'model-uuid-2',
        aiProviderId: 'provider-2',
        name: 'Claude 3 Opus',
        providerLabel: 'Anthropic',
        aiProviderTypeId: 5,
        externalId: 'claude-3-opus',
        costPerInputToken: 0.0015,
        costPerOutputToken: 0.0075,
      },
    ]);
  });

  it('should return parsed primitives from AI response', async () => {
    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Analyze a document and generate a report',
      documentIds: [],
      userId: 'user-1',
    });

    expect(result.primitives).toHaveLength(3);
    expect(result.primitives[0].id).toBe('doc-1');
    expect(result.primitives[1].type).toBe(PrimitiveType.PROMPT);
    expect(result.primitives[2].type).toBe(PrimitiveType.ARTIFACT);
  });

  it('should strip markdown code fences from response', async () => {
    mockCompletion.mockResolvedValue({
      text: '```json\n' + JSON.stringify(validPrimitives) + '\n```',
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    expect(result.primitives).toHaveLength(3);
  });

  it('should process documents and add RAG context when documentIds are provided', async () => {
    const mockCitations = [{ text: 'citation content' }];
    (processDocuments as jest.Mock).mockResolvedValue({ citations: mockCitations });
    (addContextToMessage as jest.Mock).mockReturnValue('Document context here');
    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    await generateWorkflow(mockAi, {
      description: 'Analyze docs',
      documentIds: ['doc-id-1', 'doc-id-2'],
      userId: 'user-1',
    });

    expect(processDocuments).toHaveBeenCalledWith(
      'Analyze docs',
      'user-1',
      ['doc-id-1', 'doc-id-2'],
      false,
      false,
    );
    expect(addContextToMessage).toHaveBeenCalledWith(
      'Analyze the following documents to understand their structure and content for workflow generation.',
      mockCitations,
    );
    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('Document context here'),
      expect.any(Object),
    );
  });

  it('should skip RAG context when no citations are returned', async () => {
    (processDocuments as jest.Mock).mockResolvedValue({ citations: [] });
    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: ['doc-id-1'],
      userId: 'user-1',
    });

    expect(addContextToMessage).not.toHaveBeenCalled();
  });

  it('should not call processDocuments when documentIds is empty', async () => {
    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    expect(processDocuments).not.toHaveBeenCalled();
  });

  it('should include current workflow context in the prompt when provided', async () => {
    const currentWorkflow = [
      {
        id: 'existing-1',
        type: PrimitiveType.PROMPT,
        name: 'Existing Step',
        config: { model: '', prompt: 'Old prompt' },
      },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    await generateWorkflow(mockAi, {
      description: 'Improve workflow',
      documentIds: [],
      userId: 'user-1',
      currentWorkflow,
    });

    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('Current Workflow (Regeneration Context)'),
      expect.any(Object),
    );
    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('existing-1'),
      expect.any(Object),
    );
  });

  it('should filter out primitives with invalid types', async () => {
    const mixed = [
      ...validPrimitives,
      {
        id: 'bad',
        type: 'nonexistent_type',
        name: 'Bad Node',
        config: {},
      },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(mixed),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    expect(result.primitives).toHaveLength(3);
    expect(result.primitives.find((p) => p.id === 'bad')).toBeUndefined();
  });

  it('should filter out primitives missing required fields', async () => {
    const incomplete = [
      ...validPrimitives,
      { id: 'no-type', name: 'Missing Type', config: {} },
      { type: PrimitiveType.PROMPT, name: 'Missing ID', config: {} },
      { id: 'no-config', type: PrimitiveType.PROMPT, name: 'Missing Config' },
      { id: 'no-name', type: PrimitiveType.PROMPT, config: {} },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(incomplete),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    expect(result.primitives).toHaveLength(3);
  });

  it('should throw when AI returns non-array JSON', async () => {
    mockCompletion.mockResolvedValue({
      text: '{"not": "an array"}',
    });

    await expect(
      generateWorkflow(mockAi, {
        description: 'Test',
        documentIds: [],
        userId: 'user-1',
      }),
    ).rejects.toThrow('Failed to generate a valid workflow structure. Please try again.');
  });

  it('should throw when AI returns invalid JSON', async () => {
    mockCompletion.mockResolvedValue({
      text: 'this is not json at all',
    });

    await expect(
      generateWorkflow(mockAi, {
        description: 'Test',
        documentIds: [],
        userId: 'user-1',
      }),
    ).rejects.toThrow('Failed to generate a valid workflow structure. Please try again.');
  });

  it('should throw when all primitives are filtered out', async () => {
    mockCompletion.mockResolvedValue({
      text: JSON.stringify([
        { id: 'bad', type: 'fake_type', name: 'Bad', config: {} },
      ]),
    });

    await expect(
      generateWorkflow(mockAi, {
        description: 'Test',
        documentIds: [],
        userId: 'user-1',
      }),
    ).rejects.toThrow('No valid workflow nodes were generated. Please try again with a more detailed description.');
  });

  it('should use correct AI settings', async () => {
    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    expect(mockCompletion).toHaveBeenCalledWith(
      expect.any(String),
      {
        model: 'test-model',
        temperature: 0.4,
        topP: 0.3,
      },
    );
  });

  it('should re-throw Error instances from upstream failures', async () => {
    mockBuildSystemSource.mockRejectedValue(new Error('AI provider unavailable'));

    await expect(
      generateWorkflow(mockAi, {
        description: 'Test',
        documentIds: [],
        userId: 'user-1',
      }),
    ).rejects.toThrow('AI provider unavailable');
  });

  it('should wrap non-Error throws in a generic error', async () => {
    mockBuildSystemSource.mockRejectedValue('string error');

    await expect(
      generateWorkflow(mockAi, {
        description: 'Test',
        documentIds: [],
        userId: 'user-1',
      }),
    ).rejects.toThrow('Error generating workflow');
  });

  it('should set the first available model on Prompt nodes with empty model', async () => {
    const primitivesWithEmptyModel = [
      {
        id: 'doc-1',
        type: PrimitiveType.DOCUMENT,
        name: 'Source Document',
        config: { documentId: 'uuid-1' },
        position: { x: 180, y: 20 },
      },
      {
        id: 'analyze',
        type: PrimitiveType.PROMPT,
        name: 'Analyze Content',
        config: { model: '', prompt: 'Analyze...' },
        position: { x: 180, y: 140 },
        predecessorIds: ['doc-1'],
      },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(primitivesWithEmptyModel),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    const promptNode = result.primitives.find((p) => p.type === PrimitiveType.PROMPT);
    expect(promptNode).toBeDefined();
    expect(promptNode?.config.model).toBe('model-uuid-1');
  });

  it('should set the first available model on Prompt nodes with no model field', async () => {
    const primitivesWithNoModel = [
      {
        id: 'analyze',
        type: PrimitiveType.PROMPT,
        name: 'Analyze Content',
        config: { prompt: 'Analyze...' },
        position: { x: 180, y: 140 },
      },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(primitivesWithNoModel),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    const promptNode = result.primitives.find((p) => p.type === PrimitiveType.PROMPT);
    expect(promptNode).toBeDefined();
    expect(promptNode?.config.model).toBe('model-uuid-1');
  });

  it('should use empty string for model when no models are available', async () => {
    (getAvailableModels as jest.Mock).mockResolvedValue([]);

    const primitivesWithEmptyModel = [
      {
        id: 'analyze',
        type: PrimitiveType.PROMPT,
        name: 'Analyze Content',
        config: { model: '', prompt: 'Analyze...' },
        position: { x: 180, y: 140 },
      },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(primitivesWithEmptyModel),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test',
      documentIds: [],
      userId: 'user-1',
    });

    const promptNode = result.primitives.find((p) => p.type === PrimitiveType.PROMPT);
    expect(promptNode).toBeDefined();
    expect(promptNode?.config.model).toBe('');
  });

  it('should include available models list in the prompt for LLM to choose from', async () => {
    mockCompletion.mockResolvedValue({
      text: JSON.stringify(validPrimitives),
    });

    await generateWorkflow(mockAi, {
      description: 'Test workflow',
      documentIds: [],
      userId: 'user-1',
    });

    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('GPT-4'),
      expect.any(Object),
    );
    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('Claude 3 Opus'),
      expect.any(Object),
    );
    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('model-uuid-1'),
      expect.any(Object),
    );
    expect(mockCompletion).toHaveBeenCalledWith(
      expect.stringContaining('model-uuid-2'),
      expect.any(Object),
    );
  });

  it('should preserve temperature and topP settings from LLM response', async () => {
    const primitivesWithSettings = [
      {
        id: 'creative',
        type: PrimitiveType.PROMPT,
        name: 'Creative Writing',
        config: {
          model: 'model-uuid-2',
          prompt: 'Write creatively...',
          temperature: 0.8,
          topP: 0.9,
        },
        position: { x: 180, y: 20 },
      },
      {
        id: 'analytical',
        type: PrimitiveType.PROMPT,
        name: 'Data Analysis',
        config: {
          model: 'model-uuid-1',
          prompt: 'Analyze data...',
          temperature: 0.2,
          topP: 0.1,
        },
        position: { x: 180, y: 140 },
        predecessorIds: ['creative'],
      },
    ];

    mockCompletion.mockResolvedValue({
      text: JSON.stringify(primitivesWithSettings),
    });

    const result = await generateWorkflow(mockAi, {
      description: 'Test with different settings',
      documentIds: [],
      userId: 'user-1',
    });

    const creativeNode = result.primitives.find((p) => p.id === 'creative');
    const analyticalNode = result.primitives.find((p) => p.id === 'analytical');

    expect(creativeNode?.config.temperature).toBe(0.8);
    expect(creativeNode?.config.topP).toBe(0.9);
    expect(analyticalNode?.config.temperature).toBe(0.2);
    expect(analyticalNode?.config.topP).toBe(0.1);
  });
});
