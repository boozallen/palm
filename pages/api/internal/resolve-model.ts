import type { NextApiHandler } from 'next';

import logger from '@/server/logger';
import db from '@/server/db';
import { withErrorReporting } from '@/server/withErrorReporting';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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

  const { modelId } = req.body as { modelId: string };
  if (!modelId) {
    res.status(400).json({ error: 'Missing modelId' });
    return;
  }

  try {
    const model = await db.model.findFirst({
      where: { id: modelId, deletedAt: null },
      select: { externalId: true },
    });

    if (!model) {
      res.status(404).json({ error: `Model not found: ${modelId}` });
      return;
    }

    res.status(200).json({ externalId: model.externalId });
  } catch (error) {
    logger.error('[INTERNAL/RESOLVE-MODEL] Failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal error' });
  }
};

export default withErrorReporting(handler);
