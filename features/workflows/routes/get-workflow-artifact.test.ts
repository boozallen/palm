import { router } from '@/server/trpc';
import { getWorkflowArtifactRoute } from '@/features/workflows/routes/get-workflow-artifact';
import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { TRPCError } from '@trpc/server';

const mockGetWorkflowArtifact = jest.fn();
jest.mock('@/features/workflows/dal/getWorkflowArtifact', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetWorkflowArtifact(...args),
}));

const workflowsRouter = router({ getWorkflowArtifact: getWorkflowArtifactRoute });

describe('getWorkflowArtifactRoute', () => {
  const mockUserId = '00000000-0000-0000-0000-000000000001';
  const mockArtifactId = '00000000-0000-0000-0000-000000000002';
  const mockExecutionId = '00000000-0000-0000-0000-000000000003';
  const mockWorkflowId = '00000000-0000-0000-0000-000000000004';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return artifact when user has permission', async () => {
    const mockArtifact = {
      id: mockArtifactId,
      fileExtension: '.html',
      label: 'Test Report',
      content: '<html>Test content</html>',
      workflowExecutionId: mockExecutionId,
      primitiveId: 'primitive-1',
      createdAt: new Date('2024-01-01'),
      workflowExecution: {
        id: mockExecutionId,
        triggeredBy: mockUserId,
        workflowId: mockWorkflowId,
      },
    };

    mockGetWorkflowArtifact.mockResolvedValue(mockArtifact);

    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.getWorkflowArtifact({ artifactId: mockArtifactId });

    expect(result).toEqual({
      id: mockArtifactId,
      fileExtension: '.html',
      label: 'Test Report',
      content: '<html>Test content</html>',
      workflowExecutionId: mockExecutionId,
      primitiveId: 'primitive-1',
      githubPagesUrl: null,
      createdAt: new Date('2024-01-01'),
    });
  });

  it('should throw NotFound when artifact does not exist', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000099';
    mockGetWorkflowArtifact.mockResolvedValue(null);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.getWorkflowArtifact({ artifactId: nonExistentId })).rejects.toThrow(
      TRPCError
    );
  });

  it('should throw Forbidden when user does not own the execution', async () => {
    const otherUserId = '00000000-0000-0000-0000-000000000099';
    const mockArtifact = {
      id: mockArtifactId,
      fileExtension: '.html',
      label: 'Test Report',
      content: '<html>Test content</html>',
      workflowExecutionId: mockExecutionId,
      primitiveId: 'primitive-1',
      createdAt: new Date('2024-01-01'),
      workflowExecution: {
        id: mockExecutionId,
        triggeredBy: otherUserId,
        workflowId: mockWorkflowId,
      },
    };

    mockGetWorkflowArtifact.mockResolvedValue(mockArtifact);

    const caller = workflowsRouter.createCaller(ctx);
    await expect(caller.getWorkflowArtifact({ artifactId: mockArtifactId })).rejects.toThrow(
      TRPCError
    );
  });
});
