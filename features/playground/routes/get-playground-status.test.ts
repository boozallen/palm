import playgroundRoutes from '.';
import { ContextType } from '@/server/trpc-context';
import { getPlaygroundJobStatus } from '@/features/playground/services/get-playground-status-service';

jest.mock('@/features/playground/services/get-playground-status-service');

describe('getPlaygroundStatus', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: '6de3d2d5-1918-4288-993a-7445a2c8dbf9',
    } as unknown as ContextType;
  });

  it('returns the status recorded for a given jobId', async () => {
    (getPlaygroundJobStatus as jest.Mock).mockResolvedValue({
      status: 'done',
      results: [{ text: 'hello', inputTokensUsed: 10, outputTokensUsed: 10 }],
    });

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.getPlaygroundStatus({ jobId: 'job-1' });

    expect(result.status).toBe('done');
    expect(getPlaygroundJobStatus).toHaveBeenCalledWith('job-1');
  });

  it('surfaces an error message when the job failed', async () => {
    (getPlaygroundJobStatus as jest.Mock).mockResolvedValue({
      status: 'error',
      error: 'boom',
    });

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.getPlaygroundStatus({ jobId: 'job-1' });

    expect(result.status).toBe('error');
    expect(result.error).toBe('boom');
  });
});
