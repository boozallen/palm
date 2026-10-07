import promptGeneratorRoutes from '.';
import { ContextType } from '@/server/trpc-context';
import { getGeneratePromptJobStatus } from '@/features/prompt-generator/services/get-generate-prompt-status-service';

jest.mock('@/features/prompt-generator/services/get-generate-prompt-status-service');

describe('getGeneratePromptStatus', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: '6de3d2d5-1918-4288-993a-7445a2c8dbf9',
    } as unknown as ContextType;
  });

  it('returns the status recorded for a given jobId', async () => {
    (getGeneratePromptJobStatus as jest.Mock).mockResolvedValue({
      status: 'done',
      response: { text: 'hello', inputTokensUsed: 10, outputTokensUsed: 10 },
    });

    const caller = promptGeneratorRoutes.createCaller(mockCtx);
    const result = await caller.getGeneratePromptStatus({ jobId: 'job-1' });

    expect(result.status).toBe('done');
    expect(getGeneratePromptJobStatus).toHaveBeenCalledWith('job-1');
  });

  it('surfaces an error message when the job failed', async () => {
    (getGeneratePromptJobStatus as jest.Mock).mockResolvedValue({
      status: 'error',
      error: 'boom',
    });

    const caller = promptGeneratorRoutes.createCaller(mockCtx);
    const result = await caller.getGeneratePromptStatus({ jobId: 'job-1' });

    expect(result.status).toBe('error');
    expect(result.error).toBe('boom');
  });
});
