import db from '@/server/db';
import updateWorkflow from './updateWorkflow';
import logger from '@/server/logger';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/server/db', () => {
  const mockDb: any = {
    workflow: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prompt: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  mockDb.$transaction = jest.fn((fn: (tx: typeof mockDb) => any) => fn(mockDb));
  return mockDb;
});

jest.mock('@/features/workflows/utils/sanitize', () => ({
  sanitizeForPostgres: jest.fn((input) => input),
}));

const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockUserId = '550e8400-e29b-41d4-a716-446655440001';

const mockExistingWorkflow = {
  id: mockWorkflowId,
  name: 'Original Workflow',
  description: 'Original description',
  createdBy: mockUserId,
  definition: {
    name: 'Original Workflow',
    description: 'Original description',
    primitives: [{ id: '1', type: 'test', config: {} }],
  },
};

const mockViewport = { x: 100, y: 200, zoom: 1.5 };

const mockUpdatedWorkflow = {
  id: mockWorkflowId,
  name: 'Updated Workflow',
  description: 'Updated description',
  createdBy: mockUserId,
  definition: {
    name: 'Updated Workflow',
    description: 'Updated description',
    primitives: [{ id: '2', type: 'updated', config: {} }],
    viewport: mockViewport,
    updatedAt: expect.any(Date),
  },
  userGroups: [],
};

describe('updateWorkflow', () => {
  const mockFindUnique = db.workflow.findUnique as jest.Mock;
  const mockUpdate = db.workflow.update as jest.Mock;
  const mockSanitizeForPostgres = sanitizeForPostgres as jest.Mock;
  const mockPromptCreate = db.prompt.create as jest.Mock;
  const mockPromptUpdate = db.prompt.update as jest.Mock;
  const mockPromptDeleteMany = db.prompt.deleteMany as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSanitizeForPostgres.mockImplementation((input) => input);
    mockPromptCreate.mockResolvedValue({ id: 'new-prompt-id' });
    mockPromptUpdate.mockResolvedValue(undefined);
    mockPromptDeleteMany.mockResolvedValue(undefined);
  });

  it('should update a workflow successfully', async () => {
    mockFindUnique.mockResolvedValue(mockExistingWorkflow);
    mockUpdate.mockResolvedValue(mockUpdatedWorkflow);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: 'Updated Workflow',
      description: 'Updated description',
      primitives: [{ id: '2', type: PrimitiveType.WEBSCRAPER, name: 'Updated Primitive', config: {} }],
      viewport: mockViewport,
      userGroupIds: ['group1', 'group2'],
    };

    const result = await updateWorkflow(updateParams);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
      data: {
        name: 'Updated Workflow',
        description: 'Updated description',
        definition: {
          name: 'Updated Workflow',
          description: 'Updated description',
          primitives: [{ id: '2', type: PrimitiveType.WEBSCRAPER, name: 'Updated Primitive', config: {} }],
          viewport: mockViewport,
          updatedAt: expect.any(Date),
        },
        userGroups: {
          set: [],
          connect: [{ id: 'group1' }, { id: 'group2' }],
        },
      },
      include: {
        userGroups: true,
      },
    });

    expect(mockSanitizeForPostgres).toHaveBeenCalledWith({
      name: 'Updated Workflow',
      description: 'Updated description',
      primitives: [{ id: '2', type: PrimitiveType.WEBSCRAPER, name: 'Updated Primitive', config: {} }],
      viewport: mockViewport,
      updatedAt: expect.any(Date),
    });

    expect(result).toEqual(mockUpdatedWorkflow);
  });

  it('should update workflow with only viewport changes', async () => {
    mockFindUnique.mockResolvedValue(mockExistingWorkflow);
    mockUpdate.mockResolvedValue({
      ...mockExistingWorkflow,
      definition: {
        ...mockExistingWorkflow.definition,
        viewport: mockViewport,
        updatedAt: expect.any(Date),
      },
    });

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      viewport: mockViewport,
    };

    await updateWorkflow(updateParams);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
      data: {
        definition: {
          ...mockExistingWorkflow.definition,
          viewport: mockViewport,
          updatedAt: expect.any(Date),
        },
      },
      include: {
        userGroups: true,
      },
    });
  });

  it('should handle undefined description correctly', async () => {
    mockFindUnique.mockResolvedValue(mockExistingWorkflow);
    mockUpdate.mockResolvedValue(mockUpdatedWorkflow);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      description: undefined,
    };

    await updateWorkflow(updateParams);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
      data: {
        description: undefined,
        definition: {
          ...mockExistingWorkflow.definition,
          description: undefined,
          updatedAt: expect.any(Date),
        },
      },
      include: {
        userGroups: true,
      },
    });
  });

  it('should throw error if workflow not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: 'Updated Workflow',
    };

    await expect(updateWorkflow(updateParams)).rejects.toThrow('Workflow not found');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw error if user does not have permission', async () => {
    const unauthorizedWorkflow = {
      ...mockExistingWorkflow,
      createdBy: 'different-user-id',
    };

    mockFindUnique.mockResolvedValue(unauthorizedWorkflow);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: 'Updated Workflow',
    };

    await expect(updateWorkflow(updateParams)).rejects.toThrow('You do not have permission to update this workflow');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle database errors during update', async () => {
    const mockError = new Error('Database connection failed');

    mockFindUnique.mockResolvedValue(mockExistingWorkflow);
    mockUpdate.mockRejectedValue(mockError);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: 'Updated Workflow',
    };

    await expect(updateWorkflow(updateParams)).rejects.toThrow('Database connection failed');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
    });
    expect(mockUpdate).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Error updating workflow:', mockError);
  });

  it('should handle database errors during workflow lookup', async () => {
    const mockError = new Error('Database lookup failed');

    mockFindUnique.mockRejectedValue(mockError);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: 'Updated Workflow',
    };

    await expect(updateWorkflow(updateParams)).rejects.toThrow('Database lookup failed');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: mockWorkflowId },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Error updating workflow:', mockError);
  });

  it('should store an LLM primitive as-is when it has prompt text but no promptId', async () => {
    mockFindUnique.mockResolvedValue(mockExistingWorkflow);
    mockUpdate.mockResolvedValue(mockUpdatedWorkflow);

    const llmPrimitive = {
      id: 'prim-llm',
      type: PrimitiveType.PROMPT,
      name: 'Summarizer',
      config: { model: 'claude-sonnet-4-6', prompt: 'Summarize this.' },
    };

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      primitives: [llmPrimitive],
    };

    await updateWorkflow(updateParams);

    expect(mockPromptCreate).not.toHaveBeenCalled();
    expect(mockPromptUpdate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          definition: expect.objectContaining({
            primitives: [llmPrimitive],
          }),
        }),
      }),
    );
  });

  it('should store an LLM primitive as-is when it already has a promptId', async () => {
    const existingPromptId = '550e8400-e29b-41d4-a716-446655440010';
    mockFindUnique.mockResolvedValue({
      ...mockExistingWorkflow,
      definition: {
        ...mockExistingWorkflow.definition,
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'Summarizer',
            config: { model: 'claude-sonnet-4-6', promptId: existingPromptId },
          },
        ],
      },
    });
    mockUpdate.mockResolvedValue(mockUpdatedWorkflow);

    const llmPrimitive = {
      id: 'prim-llm',
      type: PrimitiveType.PROMPT,
      name: 'Summarizer',
      config: { model: 'claude-sonnet-4-6', promptId: existingPromptId },
    };

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      primitives: [llmPrimitive],
    };

    await updateWorkflow(updateParams);

    expect(mockPromptCreate).not.toHaveBeenCalled();
    expect(mockPromptUpdate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          definition: expect.objectContaining({
            primitives: [llmPrimitive],
          }),
        }),
      }),
    );
  });

  it('should delete orphaned prompt rows when an LLM primitive is removed', async () => {
    const orphanedPromptId = '550e8400-e29b-41d4-a716-446655440010';
    mockFindUnique.mockResolvedValue({
      ...mockExistingWorkflow,
      definition: {
        ...mockExistingWorkflow.definition,
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'Old Step',
            config: { model: 'claude-sonnet-4-6', promptId: orphanedPromptId },
          },
        ],
      },
    });
    mockUpdate.mockResolvedValue(mockUpdatedWorkflow);

    // Saving without the LLM primitive — it has been removed
    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      primitives: [
        {
          id: 'prim-scraper',
          type: PrimitiveType.WEBSCRAPER,
          name: 'Scraper',
          config: { url: 'https://example.com' },
        },
      ],
    };

    await updateWorkflow(updateParams);

    expect(mockPromptDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [orphanedPromptId] }, workflows: true },
    });
  });

  it('should skip prompt creation for LLM primitives with no model configured', async () => {
    mockFindUnique.mockResolvedValue(mockExistingWorkflow);
    mockUpdate.mockResolvedValue(mockUpdatedWorkflow);

    const updateParams = {
      workflowId: mockWorkflowId,
      userId: mockUserId,
      primitives: [
        {
          id: 'prim-llm',
          type: PrimitiveType.PROMPT,
          name: 'Unconfigured',
          config: {},
        },
      ],
    };

    await updateWorkflow(updateParams);

    expect(mockPromptCreate).not.toHaveBeenCalled();
    expect(mockPromptUpdate).not.toHaveBeenCalled();
  });
});
