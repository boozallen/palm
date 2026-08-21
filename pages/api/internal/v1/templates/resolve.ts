import type { NextApiHandler } from 'next';
import { z } from 'zod';

import getTemplateForUser from '@/features/settings/dal/templates/getTemplateForUser';
import logger from '@/server/logger';

const inputSchema = z.object({
  userId: z.string().uuid(),
  fileExtension: z.string().min(1),
});

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    logger.error('[INTERNAL/V1/TEMPLATES/RESOLVE] INTERNAL_API_KEY is not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const authHeader = req.headers['authorization'];
  const isAuthorized = authHeader === `Bearer ${internalApiKey}`;
  if (!isAuthorized) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, fileExtension } = parsed.data;

  try {
    const fileData = await getTemplateForUser(userId, fileExtension);
    if (!fileData) {
      res.status(404).json({ error: 'No template found' });
      return;
    }

    res.status(200).json({ fileData: fileData.toString('base64') });
  } catch (error) {
    logger.error('Failed to resolve template', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resolve template' });
  }
};

export default handler;
