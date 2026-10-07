import db from '@/server/db';
import createWorkflow from './createWorkflow';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/server/db', () => {
  const mockDb: any = {
    workflow: {
      create: jest.fn(),
    },
    prompt: {
      create: jest.fn(),
    },
  };
  mockDb.$transaction = jest.fn((fn: (tx: typeof mockDb) => any) => fn(mockDb));
  return mockDb;
});

jest.mock('@/features/workflows/utils/sanitize', () => ({
  sanitizeForPostgres: jest.fn((v) => v),
}));

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';

const mockCreatedWorkflow = {
  id: mockWorkflowId,
  name: 'Test Workflow',
  description: 'A test workflow',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  userGroups: [],
};

describe('createWorkflow', () => {
  const mockCreate = db.workflow.create as jest.Mock;
  const mockPromptCreate = db.prompt.create as jest.Mock;
  const mockSanitize = sanitizeForPostgres as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue(mockCreatedWorkflow);
    mockPromptCreate.mockResolvedValue({ id: mockPromptId });
    mockSanitize.mockImplementation((v) => v);
  });

  it('should create a workflow and return the db record', async () => {
    const result = await createWorkflow({
      userId: mockUserId,
      name: 'Test Workflow',
      description: 'A test workflow',
      primitives: [
        {
          id: 'prim-1',
          type: PrimitiveType.WEBSCRAPER,
          name: 'Scraper Step',
          config: { url: 'https://example.com' },
        },
      ],
    });

    expect(mockCreate).toHaveBeenCalled();
    expect(result).toEqual(mockCreatedWorkflow);
  });

  it('should store an LLM primitive as-is without creating a prompt row', async () => {
    const llmPrimitive = {
      id: 'prim-llm',
      type: PrimitiveType.PROMPT,
      name: 'Summarizer',
      config: { model: 'claude-sonnet-4-6', promptId: mockPromptId },
    };

    await createWorkflow({
      userId: mockUserId,
      name: 'LLM Workflow',
      description: '',
      primitives: [llmPrimitive],
    });

    expect(mockPromptCreate).not.toHaveBeenCalled();
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.definition.primitives[0]).toEqual(llmPrimitive);
  });

  it('should store the primitive config exactly as received', async () => {
    const llmPrimitive = {
      id: 'prim-llm',
      type: PrimitiveType.PROMPT,
      name: 'Summarizer',
      config: { model: 'claude-sonnet-4-6', promptId: mockPromptId },
    };

    await createWorkflow({
      userId: mockUserId,
      name: 'LLM Workflow',
      description: '',
      primitives: [llmPrimitive],
    });

    const createCall = mockCreate.mock.calls[0][0];
    const storedPrimitive = createCall.data.definition.primitives[0];
    expect(storedPrimitive.config.promptId).toBe(mockPromptId);
    expect(storedPrimitive.config.prompt).toBeUndefined();
  });

  it('should skip prompt creation for LLM primitives with no model configured', async () => {
    await createWorkflow({
      userId: mockUserId,
      name: 'Unconfigured Workflow',
      description: '',
      primitives: [
        {
          id: 'prim-llm',
          type: PrimitiveType.PROMPT,
          name: 'Empty LLM',
          config: {},
        },
      ],
    });

    expect(mockPromptCreate).not.toHaveBeenCalled();
  });

  it('should connect user groups when userGroupIds are provided', async () => {
    await createWorkflow({
      userId: mockUserId,
      name: 'Group Workflow',
      primitives: [
        {
          id: 'p1',
          type: PrimitiveType.WEBSCRAPER,
          name: 'Scraper',
          config: { url: 'https://example.com' },
        },
      ],
      userGroupIds: ['group-1', 'group-2'],
    });

    const createData = mockCreate.mock.calls[0][0].data;
    expect(createData.userGroups.connect).toEqual([{ id: 'group-1' }, { id: 'group-2' }]);
  });

  it('should persist pinnedUserGroupId when provided', async () => {
    await createWorkflow({
      userId: mockUserId,
      name: 'Pinned Workflow',
      primitives: [
        {
          id: 'p1',
          type: PrimitiveType.WEBSCRAPER,
          name: 'Scraper',
          config: { url: 'https://example.com' },
        },
      ],
      pinnedUserGroupId: 'group-1',
    });

    const createData = mockCreate.mock.calls[0][0].data;
    expect(createData.pinnedUserGroupId).toBe('group-1');
  });

  it('should throw on database error during workflow create', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));

    await expect(
      createWorkflow({
        userId: mockUserId,
        name: 'Test',
        primitives: [
          {
            id: 'p1',
            type: PrimitiveType.WEBSCRAPER,
            name: 'Scraper',
            config: { url: 'https://example.com' },
          },
        ],
      }),
    ).rejects.toThrow('Error creating workflow');
  });
});
