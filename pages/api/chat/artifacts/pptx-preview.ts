import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';

import { authOptions } from '@/server/auth-adapter';
import { logger } from '@/server/logger';
import { getConfig } from '@/server/config';
import db from '@/server/db';

type PptxPreviewResponse = {
  slides: string[];
  count: number;
};

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const artifactId = typeof req.query['id'] === 'string' ? req.query['id'] : '';
  if (!artifactId) {
    res.status(400).json({ error: 'Missing required query parameter: id' });
    return;
  }

  try {
    const results = await db.$queryRaw<Array<{
      binaryContent: Buffer | null;
    }>>`
      SELECT a."binaryContent"
      FROM "ChatArtifact" a
      JOIN "ChatMessage" m ON m.id = a."chatMessageId"
      JOIN "Chat" c ON c.id = m."chatId"
      WHERE a.id = ${artifactId}::uuid
        AND c."userId" = ${session.user.id}::uuid
        AND a."fileExtension" = '.pptx'
      LIMIT 1
    `;

    const artifact = results[0];
    if (!artifact?.binaryContent) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    const buffer = Buffer.isBuffer(artifact.binaryContent)
      ? artifact.binaryContent
      : Buffer.from(artifact.binaryContent);

    const binaryContent = buffer.toString('base64');

    const { claudeServiceUrl, internalApiKey } = getConfig().agentServices;
    const upstream = await fetch(`${claudeServiceUrl}/pptx-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalApiKey}`,
      },
      body: JSON.stringify({ binaryContent, artifactId }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      logger.error('[PPTX-PREVIEW] claude-service error', { status: upstream.status, text });
      res.status(502).json({ error: 'Preview generation failed' });
      return;
    }

    const data = await upstream.json() as PptxPreviewResponse;
    res.status(200).json(data);
  } catch (error) {
    logger.error('[PPTX-PREVIEW] Failed to generate preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
};

export default handler;
