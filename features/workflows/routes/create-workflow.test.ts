import { router } from '@/server/trpc';
import { createWorkflow } from '@/features/workflows/routes/create-workflow';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import createWorkflowRecord from '@/features/workflows/dal/createWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { PrimitiveFactory } from '@/features/workflows/primitives/PrimitiveFactory';

jest.mock('@/features/workflows/dal/createWorkflow');
jest.mock('@/features/shared/dal/getUserWorkflowsAccess');
jest.mock('@/features/shared/dal/isUserGroupMember');
jest.mock('@/features/workflows/primitives/PrimitiveFactory');
jest.mock('@/features/ai-agents/utils/crawler', () => ({
  HTMLReader: jest.fn(),
  PuppeteerCrawlerFactory: jest.fn(),
}));

const workflowsRouter = router({ createWorkflow });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockGroupId = '550e8400-e29b-41d4-a716-446655440050';

const mockPrimitives = [
  {
    id: 'prim-1',
    type: 'webscraper',
    name: 'Scraper',
    config: { url: 'https://example.com' },
  },
];

const mockCreatedWorkflow = {
  id: mockWorkflowId,
  name: 'My Workflow',
  description: 'A workflow',
  createdAt: new Date('2024-01-01'),
};

describe('createWorkflow route', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(true);
    (isUserGroupMember as jest.Mock).mockResolvedValue(true);
    (createWorkflowRecord as jest.Mock).mockResolvedValue(mockCreatedWorkflow);
    (PrimitiveFactory.validateWorkflowPrimitives as jest.Mock).mockReturnValue({ valid: true });
  });

  it('should create a workflow and return the id and metadata', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.createWorkflow({
      name: 'My Workflow',
      description: 'A workflow',
      primitives: mockPrimitives,
    });

    expect(getUserWorkflowsAccess).toHaveBeenCalledWith(mockUserId);
    expect(createWorkflowRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        name: 'My Workflow',
        description: 'A workflow',
      }),
    );
    expect(result).toEqual({
      id: mockWorkflowId,
      name: 'My Workflow',
      description: 'A workflow',
      primitiveCount: 1,
      createdAt: mockCreatedWorkflow.createdAt,
    });
  });

  it('should throw if user does not have workflows access', async () => {
    (getUserWorkflowsAccess as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.createWorkflow({ name: 'WF', primitives: mockPrimitives }),
    ).rejects.toThrow('You do not have access to workflows');

    expect(createWorkflowRecord).not.toHaveBeenCalled();
  });

  it('should throw if primitives fail factory validation', async () => {
    (PrimitiveFactory.validateWorkflowPrimitives as jest.Mock).mockReturnValue({
      valid: false,
      errors: ['Unsupported primitive type: bad_type (ID: prim-1)'],
    });

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.createWorkflow({ name: 'WF', primitives: mockPrimitives }),
    ).rejects.toThrow('Invalid primitives');

    expect(createWorkflowRecord).not.toHaveBeenCalled();
  });

  it('should reject an empty workflow name', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.createWorkflow({ name: '', primitives: mockPrimitives }),
    ).rejects.toThrow();
  });

  it('should reject an empty primitives array', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.createWorkflow({ name: 'My WF', primitives: [] }),
    ).rejects.toThrow();
  });

  it('should validate membership and persist pinnedUserGroupId when provided', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    await caller.createWorkflow({
      name: 'My Workflow',
      primitives: mockPrimitives,
      pinnedUserGroupId: mockGroupId,
    });

    expect(isUserGroupMember).toHaveBeenCalledWith(mockUserId, mockGroupId);
    expect(createWorkflowRecord).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedUserGroupId: mockGroupId }),
    );
  });

  it('should throw if the user is not a member of the group they are trying to pin', async () => {
    (isUserGroupMember as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(
      caller.createWorkflow({
        name: 'My Workflow',
        primitives: mockPrimitives,
        pinnedUserGroupId: mockGroupId,
      }),
    ).rejects.toThrow('You are not a member of the selected group');

    expect(createWorkflowRecord).not.toHaveBeenCalled();
  });
});
