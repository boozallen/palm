import type { Job } from 'bullmq';
import { TRPCError } from '@trpc/server';
import { createErrorAuditor } from '@/server/errorAuditor';

// BullMQ equivalent of server/trpc.ts's defaultErrorMiddleware: called from
// every worker's `worker.on('failed', ...)` listener so job failures land in
// the same ErrorRecord table as tRPC and REST errors.
export function reportJobFailure(job: Job | undefined, error: unknown): void {
  const userId = (job?.data as { userId?: string | null } | undefined)?.userId ?? null;
  const code = error instanceof TRPCError ? error.code : 'JOB_FAILED';

  createErrorAuditor({ userId }).createErrorRecord({
    source: 'background-job',
    route: job?.queueName ?? null,
    code,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null,
    metadata: { jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade },
  });
}
