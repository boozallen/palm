import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/server/auth-adapter';
import { storage } from '@/server/storage/redis';
import logger from '@/server/logger';
import { createErrorAuditor } from '@/server/errorAuditor';
import { withErrorReporting } from '@/server/withErrorReporting';

const POLL_INTERVAL_MS = 50;
const MAX_STREAM_MS = 1_800_000; // 30 min

export const config = {
  api: { bodyParser: false },
};

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, await authOptions());
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { jobId } = req.query;
  if (typeof jobId !== 'string') {
    res.status(400).json({ error: 'Invalid job ID' });
    return;
  }

  let job = await storage.hgetall(`chat-job:${jobId}`);
  if (!job?.status) {
    // Worker may not have written the job to Redis yet — wait up to 3s for it to appear
    for (let i = 0; i < 6 && !job?.status; i++) {
      await new Promise<void>((resolve) => { setTimeout(resolve, 500); });
      job = await storage.hgetall(`chat-job:${jobId}`);
    }
    if (!job?.status) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  let closed = false;
  let cursor = 0;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = (): void => {
    closed = true;
    if (pollTimer) { clearTimeout(pollTimer); }
    if (maxTimer) { clearTimeout(maxTimer); }
  };

  const send = (event: string, data: string): void => {
    if (!closed) {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    }
  };

  req.on('close', cleanup);

  const poll = async (): Promise<void> => {
    if (closed) { return; }

    try {
      const items = await storage.lrange(`chat-stream:${jobId}`, cursor, -1);
      for (const raw of items) {
        if (closed) { return; }
        cursor++;
        let parsed: { t: string; v?: string };
        try {
          parsed = JSON.parse(raw) as { t: string; v?: string };
        } catch {
          continue;
        }
        if (parsed.t === 'd' && parsed.v) {
          send('delta', JSON.stringify({ text: parsed.v }));
        } else if (parsed.t === 'done') {
          send('done', '{}');
          cleanup();
          res.end();
          return;
        }
      }
    } catch (err) {
      logger.error('[CHAT-STREAM] Poll error for %s: %s', jobId, (err as Error).message);
      createErrorAuditor({ userId: session.user.id }).createErrorRecord({
        source: 'rest-api',
        route: req.url ?? null,
        code: 'CHAT_STREAM_POLL_FAILED',
        message: (err as Error).message,
        stack: err instanceof Error ? err.stack ?? null : null,
        metadata: { jobId },
      });
    }

    if (!closed) {
      pollTimer = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
    }
  };

  maxTimer = setTimeout(() => {
    if (!closed) {
      send('done', '{}');
      cleanup();
      res.end();
    }
  }, MAX_STREAM_MS);

  void poll();
}

export default withErrorReporting(handler);
