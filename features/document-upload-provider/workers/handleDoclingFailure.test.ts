import {
  RateLimitError,
  UnrecoverableError,
  Worker,
} from 'bullmq';

import {
  DoclingBusyError,
  DoclingUnrecoverableError,
} from '@/features/document-upload-provider/sources/utils/doclingClient';
import { handleDoclingFailure } from '@/features/document-upload-provider/workers/handleDoclingFailure';

describe('handleDoclingFailure', () => {
  const rateLimit = jest.fn();
  const worker: Worker = Object.assign(
    Object.create(Worker.prototype),
    { rateLimit },
  );

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimit.mockResolvedValue(undefined);
  });

  it('updates busy status before rate-limiting and requeues the job', async () => {
    let finishBusyUpdate: () => void = () => undefined;
    const busyUpdate = new Promise<void>((resolve) => {
      finishBusyUpdate = resolve;
    });
    const onBusy = jest.fn(() => busyUpdate);

    const caughtError = handleDoclingFailure(
      new DoclingBusyError(30_000),
      worker,
      onBusy,
    ).catch((error: unknown) => error);

    await Promise.resolve();

    expect(onBusy).toHaveBeenCalledTimes(1);
    expect(rateLimit).not.toHaveBeenCalled();

    finishBusyUpdate();
    const error = await caughtError;

    expect(rateLimit).toHaveBeenCalledWith(30_000);
    expect(error).toBeInstanceOf(RateLimitError);
  });

  it('converts an unrecoverable Docling error to a BullMQ unrecoverable error', async () => {
    const onBusy = jest.fn();
    const source = new DoclingUnrecoverableError();
    const caughtError = await handleDoclingFailure(
      source,
      worker,
      onBusy,
    ).catch((error: Error) => error);

    expect(caughtError).toBeInstanceOf(UnrecoverableError);
    expect(caughtError.message).toBe(source.message);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(onBusy).not.toHaveBeenCalled();
  });

  it('rethrows other errors unchanged', async () => {
    const originalError = new Error('connection failed');

    await expect(handleDoclingFailure(
      originalError,
      worker,
      jest.fn(),
    )).rejects.toBe(originalError);
    expect(rateLimit).not.toHaveBeenCalled();
  });
});
