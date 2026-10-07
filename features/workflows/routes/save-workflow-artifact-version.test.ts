import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import workflowsRouter from '@/features/workflows/routes';
import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';
import saveWorkflowArtifactVersion from '@/features/workflows/dal/saveWorkflowArtifactVersion';

jest.mock('@/features/workflows/dal/getWorkflowArtifact');
jest.mock('@/features/workflows/dal/saveWorkflowArtifactVersion');
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
const mockSaveWorkflowArtifactVersion = saveWorkflowArtifactVersion as jest.MockedFunction<
  typeof saveWorkflowArtifactVersion
>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const EXECUTION_ID = '20000000-0000-0000-0000-000000000002';
const ARTIFACT_ID = '60000000-0000-0000-0000-000000000006';

const mockArtifact = {
  id: ARTIFACT_ID,
  label: 'My Report',
  fileExtension: '.md',
  content: '# Original',
  workflowExecutionId: EXECUTION_ID,
  primitiveId: 'artifact-primitive-1',
  createdAt: new Date(),
  workflowExecution: {
    id: EXECUTION_ID,
    triggeredBy: USER_ID,
    workflowId: 'wf-1',
  },
};

const baseInput = { artifactId: ARTIFACT_ID, content: '# Edited' };

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
  mockSaveWorkflowArtifactVersion.mockResolvedValue({ content: '# Edited', versionNumber: 2 });
});

describe('saveWorkflowArtifactVersion route', () => {
  it('throws when the artifact is not found', async () => {
    mockGetWorkflowArtifact.mockResolvedValueOnce(null);
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.saveWorkflowArtifactVersion(baseInput)).rejects.toThrow(
      'Workflow artifact not found',
    );
  });

  it('throws when user did not trigger the execution and is not an admin', async () => {
    ctx.userId = 'other-user-id';
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.saveWorkflowArtifactVersion(baseInput)).rejects.toThrow(
      'You do not have permission to edit this artifact',
    );
  });

  it('throws when the artifact is a binary type', async () => {
    mockGetWorkflowArtifact.mockResolvedValueOnce({
      ...mockArtifact,
      fileExtension: '.docx',
    } as any);
    const caller = workflowsRouter.createCaller(ctx);

    await expect(caller.saveWorkflowArtifactVersion(baseInput)).rejects.toThrow(
      'This artifact type cannot be edited',
    );
  });

  it('allows an admin to edit an artifact from another user execution', async () => {
    ctx.userId = 'other-user-id';
    ctx.userRole = UserRole.Admin;
    const caller = workflowsRouter.createCaller(ctx);

    const result = await caller.saveWorkflowArtifactVersion(baseInput);
    expect(result.versionNumber).toBe(2);
  });

  it('saves a new version and returns the updated content', async () => {
    const caller = workflowsRouter.createCaller(ctx);
    const result = await caller.saveWorkflowArtifactVersion(baseInput);

    expect(mockSaveWorkflowArtifactVersion).toHaveBeenCalledWith({
      artifactId: ARTIFACT_ID,
      content: '# Edited',
      editedByUserId: USER_ID,
    });
    expect(result).toEqual({
      artifactId: ARTIFACT_ID,
      content: '# Edited',
      versionNumber: 2,
    });
  });
});
