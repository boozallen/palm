import { router } from '@/server/trpc';
import { generateWorkflowRoute } from '@/features/workflows/routes/generate-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { PrimitiveType } from '@/features/workflows/types/primitive';

const mockGenerateWorkflow = jest.fn();
jest.mock('@/features/workflows/dal/generateWorkflow', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGenerateWorkflow(...args),
}));

const workflowsRouter = router({ generateWorkflow: generateWorkflowRoute });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';

const mockPrimitives = [
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
    config: { model: '', prompt: 'Analyze the document' },
    position: { x: 180, y: 140 },
    predecessorIds: ['doc-1'],
  },
];

describe('generateWorkflowRoute', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      ai: { buildSystemSource: jest.fn() },
    } as unknown as ContextType;

    mockGenerateWorkflow.mockResolvedValue({ primitives: mockPrimitives });
  });

  it('should call generateWorkflow and return primitives', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.generateWorkflow({
      description: 'Analyze a document',
      documentIds: ['doc-id-1'],
    });

    expect(mockGenerateWorkflow).toHaveBeenCalledWith(ctx.ai, {
      description: 'Analyze a document',
      documentIds: ['doc-id-1'],
      userId: mockUserId,
      currentWorkflow: undefined,
    });
    expect(result.primitives).toHaveLength(2);
    expect(result.primitives[0].id).toBe('doc-1');
  });

  it('should pass currentWorkflow to generateWorkflow when provided', async () => {
    const currentWorkflow = [
      {
        id: 'existing',
        type: PrimitiveType.PROMPT,
        name: 'Existing',
        config: { model: '', prompt: 'old' },
      },
    ];

    const caller = workflowsRouter.createCaller(ctx);
    await caller.generateWorkflow({
      description: 'Improve this',
      documentIds: [],
      currentWorkflow,
    });

    expect(mockGenerateWorkflow).toHaveBeenCalledWith(ctx.ai, {
      description: 'Improve this',
      documentIds: [],
      userId: mockUserId,
      currentWorkflow,
    });
  });

  it('should throw UNAUTHORIZED when userId is missing', async () => {
    ctx = {
      ...ctx,
      userId: undefined,
    } as unknown as ContextType;

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.generateWorkflow({
        description: 'Test',
        documentIds: [],
      }),
    ).rejects.toThrow();
  });

  it('should throw UNAUTHORIZED when userId is null', async () => {
    ctx = {
      ...ctx,
      userId: null,
    } as unknown as ContextType;

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.generateWorkflow({
        description: 'Test',
        documentIds: [],
      }),
    ).rejects.toThrow();
  });

  it('should propagate errors from generateWorkflow dal', async () => {
    mockGenerateWorkflow.mockRejectedValue(
      new Error('Failed to generate a valid workflow structure. Please try again.'),
    );

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.generateWorkflow({
        description: 'Test',
        documentIds: [],
      }),
    ).rejects.toThrow('Failed to generate a valid workflow structure. Please try again.');
  });

  it('should accept empty documentIds array', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.generateWorkflow({
      description: 'No docs workflow',
      documentIds: [],
    });

    expect(result.primitives).toHaveLength(2);
  });
});
