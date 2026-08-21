import { router } from '@/server/trpc';
import { executeWorkflow } from '@/features/workflows/routes/execute-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import getWorkflowForExecution from '@/features/workflows/dal/getWorkflowForExecution';
import createWorkflowExecution from '@/features/workflows/dal/createWorkflowExecution';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/features/workflows/dal/getWorkflowForExecution');
jest.mock('@/features/workflows/dal/createWorkflowExecution');
jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/workflows/utils/sanitize', () => ({
  sanitizeForPostgres: jest.fn((v) => v),
}));
jest.mock('@/features/workflows/utils/worker/queue', () => ({
  getWorkflowQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('@/features/workflows/utils/workflow-conversion', () => ({
  graphToWorkflow: jest.fn(),
}));

const workflowsRouter = router({ executeWorkflow });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockExecutionId = '550e8400-e29b-41d4-a716-446655440020';

const mockWorkflow = {
  id: mockWorkflowId,
  createdBy: mockUserId,
  deletedAt: null,
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
  userGroups: [],
};

const mockExecution = {
  id: mockExecutionId,
  status: 'pending',
};

describe('executeWorkflow route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(true);
    (getWorkflowForExecution as jest.Mock).mockResolvedValue(mockWorkflow);
    (createWorkflowExecution as jest.Mock).mockResolvedValue(mockExecution);
  });

  it('should start a workflow execution and return the execution id', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.executeWorkflow({ workflowId: mockWorkflowId });

    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(getWorkflowForExecution).toHaveBeenCalledWith(mockWorkflowId, mockUserId);
    expect(createWorkflowExecution).toHaveBeenCalled();
    expect(result).toMatchObject({
      executionId: mockExecutionId,
      status: 'pending',
      message: 'Workflow execution started',
    });
  });

  it('should queue the job with raw promptId without resolving prompt text upfront', async () => {
    const promptId = '550e8400-e29b-41d4-a716-446655440010';
    const { getWorkflowQueue } = require('@/features/workflows/utils/worker/queue');
    const mockAdd = jest.fn().mockResolvedValue(undefined);
    getWorkflowQueue.mockReturnValue({ add: mockAdd });

    (getWorkflowForExecution as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      definition: {
        primitives: [
          {
            id: 'p-llm',
            type: PrimitiveType.PROMPT,
            name: 'LLM',
            config: { model: 'claude', promptId },
          },
        ],
      },
    });

    const caller = workflowsRouter.createCaller(ctx);
    await caller.executeWorkflow({ workflowId: mockWorkflowId });

    const jobData = mockAdd.mock.calls[0][1];
    const llmPrimitive = jobData.primitives.find((p: any) => p.type === PrimitiveType.PROMPT);
    expect(llmPrimitive.config.promptId).toBe(promptId);
    expect(llmPrimitive.config.prompt).toBeUndefined();
  });

  it('should throw if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have access to workflows');
  });

  it('should throw if workflow is not found', async () => {
    (getWorkflowForExecution as jest.Mock).mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow not found');
  });

  it('should throw if user does not own the workflow and has no group access', async () => {
    (getWorkflowForExecution as jest.Mock).mockResolvedValue({
      ...mockWorkflow,
      createdBy: 'another-user-id',
    });

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('You do not have permission to execute this workflow');
  });

  it('should throw when the workflow queue is not initialized', async () => {
    const { getWorkflowQueue } = require('@/features/workflows/utils/worker/queue');
    getWorkflowQueue.mockReturnValueOnce(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.executeWorkflow({ workflowId: mockWorkflowId }),
    ).rejects.toThrow('Workflow system is not available at this time.');
  });
});
