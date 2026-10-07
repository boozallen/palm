import type { NextApiHandler } from 'next';

import db from '@/server/db';
import logger from '@/server/logger';
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

  const { chatId, label } = req.body as { chatId: string; label: string };
  if (!chatId || !label) {
    res.status(400).json({ error: 'Missing chatId or label' });
    return;
  }

  try {
    const artifact = await db.chatArtifact.findFirst({
      where: {
        label,
        message: { chatId },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        fileExtension: true,
        label: true,
        content: true,
        binaryContent: true,
      },
    });

    if (!artifact) {
      res.status(404).json({ error: `Artifact '${label}' not found` });
      return;
    }

    logger.info('[INTERNAL/ARTIFACT-TEXT] label=%s ext=%s', artifact.label, artifact.fileExtension);

    // For binary artifacts, return the raw bytes as base64 so the caller can extract text
    if (artifact.binaryContent) {
      const buf = Buffer.isBuffer(artifact.binaryContent)
        ? artifact.binaryContent
        : Buffer.from(artifact.binaryContent);
      res.status(200).json({
        label: artifact.label,
        extension: artifact.fileExtension,
        binaryContent: buf.toString('base64'),
      });
      return;
    }

    // For text artifacts (.html, display content, etc.), return content directly
    if (artifact.content) {
      res.status(200).json({
        label: artifact.label,
        extension: artifact.fileExtension,
        text: artifact.content,
      });
      return;
    }

    res.status(404).json({ error: 'No content available for this artifact' });
  } catch (error) {
    logger.error('[INTERNAL/ARTIFACT-TEXT] Failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal error' });
  }
};

export default withErrorReporting(handler);
