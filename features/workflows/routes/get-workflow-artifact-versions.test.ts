import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import workflowsRouter from '@/features/workflows/routes';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import getWorkflowArtifactVersions from '@/features/workflows/dal/getWorkflowArtifactVersions';

jest.mock('@/features/workflows/dal/getWorkflowArtifact');
jest.mock('@/features/workflows/dal/getWorkflowArtifactVersions');
jest.mock('@/features/ai-agents/utils/crawler', () => ({
  HTMLReader: jest.fn(),
  PuppeteerCrawlerFactory: jest.fn(),
}));
jest.mock('@/features/workflows/utils/worker/queue', () => ({
  getWorkflowQueue: jest.fn(),
  closeWorkflowQueue: jest.fn(),
}));

const mockGetWorkflowArtifact = getWorkflowArtifact as jest.MockedFunction<
  typeof getWorkflowArtifact
>;
const mockGetWorkflowArtifactVersions = getWorkflowArtifactVersions as jest.MockedFunction<
  typeof getWorkflowArtifactVersions
>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const EXECUTION_ID = '20000000-0000-0000-0000-000000000002';
const ARTIFACT_ID = '60000000-0000-0000-0000-000000000006';

const mockArtifact = {
  id: ARTIFACT_ID,
  label: 'My Report',
  fileExtension: '.md',
  content: '# Edited',
  workflowExecutionId: EXECUTION_ID,
  primitiveId: 'artifact-primitive-1',
  createdAt: new Date(),
  workflowExecution: {
    id: EXECUTION_ID,
    triggeredBy: USER_ID,
    workflowId: 'wf-1',
  },
};

const baseInput = { artifactId: ARTIFACT_ID };

let ctx: ContextType;

beforeEach(() => {
  jest.clearAllMocks();

  ctx = {
    userId: USER_ID,
    userRole: UserRole.User,
    logger,
    auditor: { createAuditRecord: jest.fn() },
  } as unknown as ContextType;

  mockGetWorkflowArtifact.mockResolvedValue(mockArtifact as any);
  mockGetWorkflowArtifactVersions.mockResolvedValue([
    { id: '70000000-0000-0000-0000-000000000007', versionNumber: 1, content: '# Original', editedByUserId: null, createdAt: new Date() },
    { id: '70000000-0000-0000-0000-000000000008', versionNumber: 2, content: '# Edited', editedByUserId: USER_ID, createdAt: new Date() },
  ]);
});

describe('getWorkflowArtifactVersions route', () => {
  it('throws when the artifact is not found', async () => {
    mockGetWorkflowArtifact.mockResolvedValueOnce(null);
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.getWorkflowArtifactVersions(baseInput)).rejects.toThrow(
      'Workflow artifact not found',
    );
  });

  it('throws when user did not trigger the execution and is not an admin', async () => {
    ctx.userId = 'other-user-id';
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.getWorkflowArtifactVersions(baseInput)).rejects.toThrow(
      'You do not have permission to view this artifact version history',
    );
  });

  it('allows an admin to view version history from another user execution', async () => {
    ctx.userId = 'other-user-id';
    ctx.userRole = UserRole.Admin;
    const caller = workflowsRouter.createCaller(ctx);

    const result = await caller.getWorkflowArtifactVersions(baseInput);
    expect(result.versions).toHaveLength(2);
  });

  it('returns the version history for the artifact', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.getWorkflowArtifactVersions(baseInput);

    expect(mockGetWorkflowArtifactVersions).toHaveBeenCalledWith(ARTIFACT_ID);
    expect(result.versions.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});
