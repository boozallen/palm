import { router } from '@/server/trpc';
import { planWorkflowConversationalRoute } from '@/features/workflows/routes/plan-workflow-conversational';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';

jest.mock('@/features/shared/dal/isUserGroupMember');

const mockPlanWorkflowConversational = jest.fn();
jest.mock('@/features/workflows/dal/planWorkflowConversational', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockPlanWorkflowConversational(...args),
}));

const workflowsRouter = router({ planWorkflowConversational: planWorkflowConversationalRoute });

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';

const baseInput = {
  userMessage: 'Build me a workflow that summarizes a document',
  documentIds: [] as string[],
  conversationHistory: [] as { role: 'user' | 'assistant'; content: string }[],
};

const mockConversationalResponse = {
  type: 'conversation' as const,
  message: 'What should the workflow do?',
  isReadyToGenerate: false,
};

describe('planWorkflowConversationalRoute', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      ai: { buildSystemSource: jest.fn() },
    } as unknown as ContextType;

    mockPlanWorkflowConversational.mockResolvedValue(mockConversationalResponse);
  });

  it('should call planWorkflowConversational and return the result', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.planWorkflowConversational(baseInput);

    expect(mockPlanWorkflowConversational).toHaveBeenCalledWith(expect.anything(), {
      userMessage: baseInput.userMessage,
      documentIds: baseInput.documentIds,
      userId: mockUserId,
      conversationHistory: baseInput.conversationHistory,
      currentWorkflow: undefined,
      availableModels: [],
    });
    expect(result).toEqual(mockConversationalResponse);
  });

  it('should throw UNAUTHORIZED when userId is missing', async () => {
    ctx = { ...ctx, userId: undefined } as unknown as ContextType;

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.planWorkflowConversational(baseInput)).rejects.toThrow();
  });

  it('should propagate errors from planWorkflowConversational dal', async () => {
    mockPlanWorkflowConversational.mockRejectedValue(new Error('Failed to plan workflow'));

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.planWorkflowConversational(baseInput)).rejects.toThrow('Failed to plan workflow');
  });

  it('attributes usage to the selected group when the user is a member', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    (isUserGroupMember as jest.Mock).mockResolvedValue(true);

    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.planWorkflowConversational({ ...baseInput, userGroupId: mockUserGroupId });

    expect(result).toEqual(mockConversationalResponse);
    expect(isUserGroupMember).toHaveBeenCalledWith(mockUserId, mockUserGroupId);
  });

  it('rejects a selected group the user is not a member of', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    (isUserGroupMember as jest.Mock).mockResolvedValue(false);

    const caller = workflowsRouter.createCaller(ctx);

    await expect(
      caller.planWorkflowConversational({ ...baseInput, userGroupId: mockUserGroupId }),
    ).rejects.toThrow('You are not a member of the selected group');

    expect(isUserGroupMember).toHaveBeenCalledWith(mockUserId, mockUserGroupId);
    expect(mockPlanWorkflowConversational).not.toHaveBeenCalled();
  });
});
