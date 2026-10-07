import type { NextApiHandler } from 'next';

import logger from '@/server/logger';
import db from '@/server/db';
import { withErrorReporting } from '@/server/withErrorReporting';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${internalApiKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Consumers of this list request completions, so embedding models are excluded.
    const models = await db.model.findMany({
      where: { deletedAt: null, embeddingsOnly: false },
      select: { id: true, name: true, externalId: true },
    });
    res.status(200).json({ models });
  } catch (error) {
    logger.error('[INTERNAL/LIST-MODELS] Failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal error' });
  }
};

export default withErrorReporting(handler);
