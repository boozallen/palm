import type { NextApiHandler } from 'next';

import db from '@/server/db';
import logger from '@/server/logger';
import { withErrorReporting } from '@/server/withErrorReporting';

const SOURCE_SCRIPT_EXTENSIONS = ['.xlsx', '.pptx', '.docx'] as const;

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
      select: { sourceJson: true, sourceScript: true, fileExtension: true, label: true, binaryContent: true },
    });

    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    if (SOURCE_SCRIPT_EXTENSIONS.includes(artifact.fileExtension as typeof SOURCE_SCRIPT_EXTENSIONS[number])) {
      // .docx edits always use the unzip/XML/rezip path — return the binary regardless of
      // whether a sourceScript exists. .xlsx and .pptx use the script-rewrite path.
      if (artifact.fileExtension === '.docx') {
        if (artifact.binaryContent) {
          res.status(200).json({
            binaryContent: Buffer.from(artifact.binaryContent).toString('base64'),
            filename: `${artifact.label}${artifact.fileExtension}`,
          });
          return;
        }
        res.status(404).json({ error: 'No binary content stored for this artifact' });
        return;
      }
      if (artifact.sourceScript) {
        res.status(200).json({ sourceScript: artifact.sourceScript });
        return;
      }
      if (artifact.binaryContent) {
        res.status(200).json({
          binaryContent: Buffer.from(artifact.binaryContent).toString('base64'),
          filename: `${artifact.label}${artifact.fileExtension}`,
        });
        return;
      }
      res.status(404).json({ error: 'No source script or binary content stored for this artifact' });
      return;
    }

    if (!artifact.sourceJson) {
      res.status(404).json({ error: 'No source JSON stored for this artifact' });
      return;
    }

    res.status(200).json({ sourceJson: artifact.sourceJson as Record<string, unknown> });
  } catch (error) {
    logger.error('[INTERNAL/ARTIFACT-SOURCE] Failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal error' });
  }
};

export default withErrorReporting(handler);
