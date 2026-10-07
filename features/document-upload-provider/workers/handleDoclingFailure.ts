import { UnrecoverableError, Worker } from 'bullmq';

import {
  DoclingBusyError,
  DoclingUnrecoverableError,
} from '@/features/document-upload-provider/sources/utils/doclingClient';

export async function handleDoclingFailure(
  error: unknown,
  worker: Worker,
  onBusy: () => Promise<void>,
): Promise<never> {
  if (error instanceof DoclingBusyError) {
    await onBusy();
    await worker.rateLimit(error.retryAfterMs);
    throw Worker.RateLimitError();
  }

  if (error instanceof DoclingUnrecoverableError) {
    throw new UnrecoverableError(error.message);
  }

  throw error;
}
