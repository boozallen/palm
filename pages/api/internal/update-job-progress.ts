import type { NextApiHandler } from 'next';

import logger from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { withErrorReporting } from '@/server/withErrorReporting';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    logger.error('[INTERNAL/UPDATE-JOB-PROGRESS] INTERNAL_API_KEY is not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${internalApiKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { jobId, progress, thinking } = req.body as { jobId: string; progress?: string; thinking?: string };

  const message = progress ?? thinking;

  if (!jobId || !message) {
    res.status(400).json({ error: 'Missing required fields: jobId and one of progress or thinking' });
    return;
  }

  try {
    await storage.rpush(`chat-job-progress:${jobId}`, message);
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('[INTERNAL/UPDATE-JOB-PROGRESS] Failed', { jobId, error });
    res.status(500).json({ error: (error as Error).message });
  }
};

export default withErrorReporting(handler);
