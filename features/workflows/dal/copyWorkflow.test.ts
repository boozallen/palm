import db from '@/server/db';
import copyWorkflow from './copyWorkflow';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/server/db', () => {
  const mockDb: Record<string, unknown> = {
    workflow: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    prompt: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  mockDb.$transaction = jest.fn((fn: (tx: typeof mockDb) => unknown) => fn(mockDb));
  return mockDb;
});

jest.mock('@/features/workflows/utils/sanitize', () => ({
  sanitizeForPostgres: jest.fn((v) => v),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mocked-uuid'),
}));

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockCopiedWorkflowId = '550e8400-e29b-41d4-a716-446655440099';
const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';
const mockNewPromptId = '550e8400-e29b-41d4-a716-446655440020';

const mockSourceWorkflow = {
  id: mockWorkflowId,
  name: 'Source Workflow',
  description: 'A source workflow',
  version: '1.0.0',
  definition: {
    primitives: [
      {
        id: 'prim-1',
        type: PrimitiveType.WEBSCRAPER,
        name: 'Scraper',
        config: { url: 'https://example.com' },
      },
    ],
  },
};

describe('copyWorkflow', () => {
  const mockFindUnique = db.workflow.findUnique as jest.Mock;
  const mockCreate = db.workflow.create as jest.Mock;
  const mockPromptFindUnique = db.prompt.findUnique as jest.Mock;
  const mockPromptCreate = db.prompt.create as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(mockSourceWorkflow);
    mockCreate.mockResolvedValue({ id: mockCopiedWorkflowId });
    mockPromptCreate.mockResolvedValue({ id: mockNewPromptId });
    (sanitizeForPostgres as jest.Mock).mockImplementation((v) => v);
  });

  it('should copy a workflow and return the copied id and name', async () => {
    const result = await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    expect(result).toEqual({
      copiedWorkflowId: mockCopiedWorkflowId,
      workflowName: 'Source Workflow',
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: mockWorkflowId, deletedAt: null },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Source Workflow (Copy)',
          createdBy: mockUserId,
        }),
      }),
    );
  });

  it('should throw when the source workflow is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      copyWorkflow({
        workflowId: mockWorkflowId,
        userId: mockUserId,
        userGroupIds: [],
      }),
    ).rejects.toThrow('Workflow not found');
  });

  it('should clear config for document_input primitives', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockSourceWorkflow,
      definition: {
        primitives: [
          {
            id: 'prim-doc',
            type: PrimitiveType.DOCUMENT,
            name: 'Document',
            config: { fileId: 'some-file' },
          },
        ],
      },
    });

    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    const createCall = mockCreate.mock.calls[0][0];
    const copiedPrimitive = createCall.data.definition.primitives[0];
    expect(copiedPrimitive.config).toEqual({});
  });

  it('should create a new prompt for PROMPT primitives with a model', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockSourceWorkflow,
      definition: {
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'Summarizer',
            config: {
              model: 'claude-sonnet-4-6',
              prompt: 'Summarize this.',
              temperature: 0.5,
              topP: 0.9,
              frequencyPenalty: 0.3,
              presencePenalty: 0.6,
            },
          },
        ],
      },
    });

    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    expect(mockPromptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructions: 'Summarize this.',
          model: 'claude-sonnet-4-6',
          creatorId: mockUserId,
        }),
      }),
    );

    const createCall = mockCreate.mock.calls[0][0];
    const copiedPrimitive = createCall.data.definition.primitives[0];
    expect(copiedPrimitive.config.promptId).toBe(mockNewPromptId);
    expect(copiedPrimitive.config.temperature).toBe(0.5);
    expect(copiedPrimitive.config.topP).toBe(0.9);
    expect(copiedPrimitive.config.frequencyPenalty).toBe(0.3);
    expect(copiedPrimitive.config.presencePenalty).toBe(0.6);
  });

  it('should fetch instructions from source prompt when promptId is set', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockSourceWorkflow,
      definition: {
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'Summarizer',
            config: {
              model: 'claude-sonnet-4-6',
              promptId: mockPromptId,
            },
          },
        ],
      },
    });
    mockPromptFindUnique.mockResolvedValue({
      id: mockPromptId,
      instructions: 'Original instructions',
    });

    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    expect(mockPromptFindUnique).toHaveBeenCalledWith({
      where: { id: mockPromptId },
    });
    expect(mockPromptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructions: 'Original instructions',
        }),
      }),
    );
  });

  it('should skip prompt creation for LLM primitives with no model, promptId, or prompt', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockSourceWorkflow,
      definition: {
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'Empty LLM',
            config: {},
          },
        ],
      },
    });

    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    expect(mockPromptCreate).not.toHaveBeenCalled();
  });

  it('should connect user groups when userGroupIds are provided', async () => {
    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: ['group-1', 'group-2'],
    });

    const createData = mockCreate.mock.calls[0][0].data;
    expect(createData.userGroups.connect).toEqual([
      { id: 'group-1' },
      { id: 'group-2' },
    ]);
  });

  it('should not connect user groups when userGroupIds is empty', async () => {
    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    const createData = mockCreate.mock.calls[0][0].data;
    expect(createData.userGroups).toBeUndefined();
  });

  it('should sanitize the copied definition', async () => {
    await copyWorkflow({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      userGroupIds: [],
    });

    expect(sanitizeForPostgres).toHaveBeenCalled();
  });
});
