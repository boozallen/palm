import { storage } from '@/server/storage/redis';

const CANCEL_FLAG_TTL_SECONDS = 3600;

/**
 * Thrown at a worker checkpoint when a cancellation flag is observed. Caught by
 * the worker's catch block to route into rollback instead of the failure path.
 */
export class GraphBuildCancelledError extends Error {
  constructor(public readonly graphId: string) {
    super(`Graph build cancelled: ${graphId}`);
    this.name = 'GraphBuildCancelledError';
  }
}

export const graphCancelKey = (graphId: string): string => `graph-cancel:${graphId}`;

export async function requestGraphCancellation(graphId: string): Promise<void> {
  await storage.setex(graphCancelKey(graphId), CANCEL_FLAG_TTL_SECONDS, '1');
}

/**
 * A Redis blip must read as "not cancelled" — never crash a build over a
 * transient flag-read failure.
 */
export async function isGraphCancellationRequested(graphId: string): Promise<boolean> {
  try {
    return (await storage.get(graphCancelKey(graphId))) !== null;
  } catch {
    return false;
  }
}

export async function clearGraphCancellation(graphId: string): Promise<void> {
  try {
    await storage.del(graphCancelKey(graphId));
  } catch {
    // Best effort — a leftover flag is cleared defensively before the next build's enqueue.
  }
}
