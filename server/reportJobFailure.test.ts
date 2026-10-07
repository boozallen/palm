import type { Job } from 'bullmq';
import { TRPCError } from '@trpc/server';

import { reportJobFailure } from './reportJobFailure';
import { createErrorAuditor } from '@/server/errorAuditor';

jest.mock('@/server/errorAuditor', () => ({
  createErrorAuditor: jest.fn(),
}));

describe('reportJobFailure', () => {
  const createErrorRecord = jest.fn();

  const buildJob = (overrides: Partial<Job> = {}): Job => ({
    id: 'job-1',
    name: 'process-chat',
    queueName: 'chat-jobs',
    data: { userId: 'user-1' },
    attemptsMade: 1,
    ...overrides,
  } as unknown as Job);

  beforeEach(() => {
    jest.clearAllMocks();
    (createErrorAuditor as jest.Mock).mockReturnValue({ createErrorRecord });
  });

  it('attributes the failure to the job data userId', () => {
    reportJobFailure(buildJob(), new Error('boom'));

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(createErrorRecord).toHaveBeenCalledWith({
      source: 'background-job',
      route: 'chat-jobs',
      code: 'JOB_FAILED',
      message: 'boom',
      stack: expect.any(String),
      metadata: { jobId: 'job-1', jobName: 'process-chat', attemptsMade: 1 },
    });
  });

  it('falls back to no user when the job data has none (e.g. conversation-graph sync)', () => {
    reportJobFailure(buildJob({ data: { chatId: 'chat-1' } }), new Error('boom'));

    expect(createErrorAuditor).toHaveBeenCalledWith({ userId: null });
  });

  it('does not throw when the job itself is undefined', () => {
    expect(() => reportJobFailure(undefined, new Error('boom'))).not.toThrow();
    expect(createErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      route: null,
      metadata: { jobId: undefined, jobName: undefined, attemptsMade: undefined },
    }));
  });

  it('keeps the real code when the failure is already a TRPCError', () => {
    reportJobFailure(buildJob(), new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'db down' }));

    expect(createErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'db down',
    }));
  });

  it('stringifies a non-Error throw', () => {
    reportJobFailure(buildJob(), 'a plain string failure');

    expect(createErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      code: 'JOB_FAILED',
      message: 'a plain string failure',
      stack: null,
    }));
  });
});
