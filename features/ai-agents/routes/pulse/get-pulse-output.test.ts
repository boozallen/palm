import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getPulseOutputRoute from '@/features/ai-agents/routes/pulse/get-pulse-output';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getPulseJobOutput from '@/features/ai-agents/dal/pulse/getPulseJobOutput';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/pulse/getPulseJobOutput');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetOutput = getPulseJobOutput as jest.Mock;

const testRouter = router({
  getPulseOutput: getPulseOutputRoute,
});

const agentId = '11111111-1111-1111-1111-111111111111';
const jobId = '22222222-2222-2222-2222-222222222222';

describe('getPulseOutput route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
      errorAuditor: { createErrorRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PULSE }]);
    mockGetOutput.mockResolvedValue('<html>dashboard</html>');
  });

  it('returns the results dashboard as html text', async () => {
    const result = await testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'dashboard',
    });

    expect(result).toEqual({
      output: 'dashboard',
      mimeType: 'text/html',
      encoding: 'utf8',
      content: '<html>dashboard</html>',
    });
  });

  it('returns the slides as html text', async () => {
    mockGetOutput.mockResolvedValue('<html>slides</html>');

    const result = await testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'slides',
    });

    expect(result).toMatchObject({ output: 'slides', mimeType: 'text/html', content: '<html>slides</html>' });
  });

  it('returns the executive summary pdf as base64 so it survives the json response', async () => {
    mockGetOutput.mockResolvedValue(Buffer.from([37, 80, 68, 70]));

    const result = await testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'pdf',
    });

    expect(result).toEqual({
      output: 'pdf',
      mimeType: 'application/pdf',
      encoding: 'base64',
      content: 'JVBERg==',
    });
  });

  // One user's own run under a different PULSE agent is not downloadable from this one.
  it('reads the output only for the signed-in user\'s run under this agent', async () => {
    await testRouter.createCaller(mockCtx).getPulseOutput({ agentId, jobId, output: 'dashboard' });

    expect(mockGetOutput).toHaveBeenCalledWith(jobId, 'user-1', agentId, 'dashboard');
  });

  it('reports a run belonging to another agent as not found', async () => {
    mockGetOutput.mockResolvedValue(null);

    await expect(testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'dashboard',
    })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'PULSE output not found' });
  });

  it('reports a missing output as not found', async () => {
    mockGetOutput.mockResolvedValue(null);

    await expect(testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'pdf',
    })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'PULSE output not found' });
  });

  it('rejects an output kind that does not exist', async () => {
    const unknownKind = { agentId, jobId, output: 'spreadsheet' } as unknown as {
      agentId: string;
      jobId: string;
      output: 'dashboard';
    };

    await expect(testRouter.createCaller(mockCtx).getPulseOutput(unknownKind)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockGetOutput).not.toHaveBeenCalled();
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    await expect(testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'dashboard',
    })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'PULSE agent not found or access denied' });
    expect(mockGetOutput).not.toHaveBeenCalled();
  });

  it('rejects an agent of another type at the same id', async () => {
    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PRISM }]);

    await expect(testRouter.createCaller(mockCtx).getPulseOutput({
      agentId,
      jobId,
      output: 'dashboard',
    })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'PULSE agent not found or access denied' });
  });
});
