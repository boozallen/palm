import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';

import { authOptions } from '@/server/auth-adapter';
import { logger } from '@/server/logger';
import { queryToSeed, tryNovaCanvas } from '@/features/video-generation/utils/worker/image-worker-service';
import { withErrorReporting } from '@/server/withErrorReporting';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, await authOptions());
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
  const seedParam = typeof req.query['seed'] === 'string' ? req.query['seed'] : '0';

  if (!q) {
    res.status(400).json({ error: 'Missing required query parameter: q' });
    return;
  }

  const seed = queryToSeed(q, seedParam);

  const imageBuffer = await tryNovaCanvas(q, seed);
  if (imageBuffer) {
    res
      .status(200)
      .setHeader('Content-Type', 'image/jpeg')
      .setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      .setHeader('Content-Length', imageBuffer.length)
      .end(imageBuffer);
    return;
  }

  logger.error('All image sources failed', { q });
  res.status(500).json({ error: 'Image generation failed' });
};

export default withErrorReporting(handler);
