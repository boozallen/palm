import { storage } from '@/server/storage/redis';
import logger from '@/server/logger';
import { SESSION_TIMEOUT_MS } from '@/server/services/sessionExpiryReconciler';

const lastSeenKey = (userId: string): string => `session-last-seen:${userId}`;
const LAST_SEEN_TTL_SECONDS = Math.ceil(SESSION_TIMEOUT_MS / 1000);

// Called from every tRPC request (server/trpc-context.ts) so a user who is
// genuinely active but not triggering any auditable action — reading and
// sending chat messages, for example — still registers as alive to the
// session-expiry reconciler. Best-effort: a Redis hiccup must never fail the
// request it's piggybacking on.
export async function touchLastSeen(userId: string): Promise<void> {
  try {
    await storage.setex(lastSeenKey(userId), LAST_SEEN_TTL_SECONDS, '1');
  } catch (error) {
    logger.debug('[session-last-seen] failed to touch last-seen key', error);
  }
}

// Fails open (reports "not recently active") on a Redis error, so an outage
// falls back to the reconciler's original audit-record-only behavior instead
// of suppressing every expiry check.
export async function wasRecentlyActive(userId: string): Promise<boolean> {
  try {
    return (await storage.get(lastSeenKey(userId))) !== null;
  } catch (error) {
    logger.debug('[session-last-seen] failed to read last-seen key', error);
    return false;
  }
}
