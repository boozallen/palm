import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import workflowRouter from './index';
import updateWorkflowRecord from '@/features/workflows/dal/updateWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import { PrimitiveFactory } from '@/features/workflows/primitives/PrimitiveFactory';

jest.mock('@/features/workflows/dal/updateWorkflow');
jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/workflows/primitives/PrimitiveFactory');
jest.mock('@/features/ai-agents/utils/crawler', () => ({
  HTMLReader: jest.fn(),
  PuppeteerCrawlerFactory: jest.fn(),
}));
jest.mock('@/features/workflows/utils/worker/queue', () => ({
  getWorkflowQueue: jest.fn(),
}));

const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockUserId = '550e8400-e29b-41d4-a716-446655440001';

const mockPrimitives = [
  {
    id: 'primitive1',
    type: 'prompt',
    name: 'Test Prompt',
    config: { prompt: 'Test prompt content' },
  },
];

const mockViewport = { x: 100, y: 200, zoom: 1.5 };

const mockUpdatedWorkflow = {
  id: mockWorkflowId,
  name: 'Updated Workflow',
  description: 'Updated description',
  createdBy: mockUserId,
  definition: {
    name: 'Updated Workflow',
    description: 'Updated description',
    primitives: mockPrimitives,
    viewport: mockViewport,
  },
  updatedAt: new Date('2023-01-01T00:00:00Z'),
  userGroups: [],
};

describe('updateWorkflow', () => {
  let ctx: ContextType;
  const mockGetUserWorkflowsAccess = getUserWorkflowsAccess as jest.Mock;
  const mockUpdateWorkflowRecord = updateWorkflowRecord as jest.Mock;
  const mockPrimitiveFactoryValidate = PrimitiveFactory.validateWorkflowPrimitives as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    mockGetUserWorkflowsAccess.mockResolvedValue(true);
    mockUpdateWorkflowRecord.mockResolvedValue(mockUpdatedWorkflow);
    mockPrimitiveFactoryValidate.mockReturnValue({ valid: true });
  });

  it('should update a workflow with all parameters', async () => {
    const input = {
      workflowId: mockWorkflowId,
      name: 'Updated Workflow',
      description: 'Updated description',
      primitives: mockPrimitives,
      viewport: mockViewport,
      userGroupIds: ['550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003'],
    };

    const caller = workflowRouter.createCaller(ctx);
    const result = await caller.updateWorkflow(input);

    expect(mockGetUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(mockPrimitiveFactoryValidate).toHaveBeenCalledWith(mockPrimitives);
    expect(mockUpdateWorkflowRecord).toHaveBeenCalledWith({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: 'Updated Workflow',
      description: 'Updated description',
      primitives: mockPrimitives,
      viewport: mockViewport,
      userGroupIds: ['550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003'],
    });

    expect(result).toEqual({
      id: mockWorkflowId,
      name: 'Updated Workflow',
      description: 'Updated description',
      primitiveCount: 1,
      updatedAt: mockUpdatedWorkflow.updatedAt,
    });
  });

  it('should update a workflow with only viewport changes', async () => {
    const input = {
      workflowId: mockWorkflowId,
      viewport: mockViewport,
    };

    const workflowWithExistingPrimitives = {
      ...mockUpdatedWorkflow,
      definition: {
        ...mockUpdatedWorkflow.definition,
        primitives: [{ id: '1' }, { id: '2' }],
      },
    };
    mockUpdateWorkflowRecord.mockResolvedValue(workflowWithExistingPrimitives);

    const caller = workflowRouter.createCaller(ctx);
    const result = await caller.updateWorkflow(input);

    expect(mockGetUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(mockPrimitiveFactoryValidate).not.toHaveBeenCalled();
    expect(mockUpdateWorkflowRecord).toHaveBeenCalledWith({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: undefined,
      description: undefined,
      primitives: undefined,
      viewport: mockViewport,
      userGroupIds: undefined,
    });

    expect(result).toEqual({
      id: mockWorkflowId,
      name: mockUpdatedWorkflow.name,
      description: mockUpdatedWorkflow.description,
      primitiveCount: 2,
      updatedAt: mockUpdatedWorkflow.updatedAt,
    });
  });

  it('should handle workflow with no primitives', async () => {
    const workflowWithNoPrimitives = {
      ...mockUpdatedWorkflow,
      definition: {},
    };
    mockUpdateWorkflowRecord.mockResolvedValue(workflowWithNoPrimitives);

    const input = {
      workflowId: mockWorkflowId,
      name: 'Updated Workflow',
    };

    const caller = workflowRouter.createCaller(ctx);
    const result = await caller.updateWorkflow(input);

    expect(result.primitiveCount).toBe(0);
  });

  it('should throw error if user does not have workflows access', async () => {
    mockGetUserWorkflowsAccess.mockResolvedValue(false);

    const input = {
      workflowId: mockWorkflowId,
      name: 'Updated Workflow',
    };

    const caller = workflowRouter.createCaller(ctx);
    await expect(caller.updateWorkflow(input)).rejects.toThrow('You do not have access to workflows');

    expect(mockGetUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(mockUpdateWorkflowRecord).not.toHaveBeenCalled();
  });

  it('should throw error if primitives validation fails', async () => {
    const invalidPrimitives = [
      {
        id: 'invalid',
        type: 'prompt',
        name: 'Invalid Primitive',
        config: {},
      },
    ];

    mockPrimitiveFactoryValidate.mockReturnValue({
      valid: false,
      errors: ['Invalid primitive type', 'Missing required config'],
    });

    const input = {
      workflowId: mockWorkflowId,
      primitives: invalidPrimitives,
    };

    const caller = workflowRouter.createCaller(ctx);
    await expect(caller.updateWorkflow(input)).rejects.toThrow(
      'Invalid primitives: Invalid primitive type, Missing required config'
    );

    expect(mockPrimitiveFactoryValidate).toHaveBeenCalledWith(invalidPrimitives);
    expect(mockUpdateWorkflowRecord).not.toHaveBeenCalled();
  });

  it('should validate input schema correctly', async () => {
    const validInput = {
      workflowId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Valid Name',
    };

    const caller = workflowRouter.createCaller(ctx);
    await expect(caller.updateWorkflow(validInput)).resolves.toBeDefined();
  });

  it('should handle optional fields correctly', async () => {
    const input = {
      workflowId: mockWorkflowId,
      description: undefined,
    };

    const caller = workflowRouter.createCaller(ctx);
    await caller.updateWorkflow(input);

    expect(mockUpdateWorkflowRecord).toHaveBeenCalledWith({
      workflowId: mockWorkflowId,
      userId: mockUserId,
      name: undefined,
      description: undefined,
      primitives: undefined,
      viewport: undefined,
      userGroupIds: undefined,
    });
  });
});
