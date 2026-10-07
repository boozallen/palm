import type { NextApiRequest, NextApiResponse } from 'next';

import db from '@/server/db';
import { withErrorReporting } from '@/server/withErrorReporting';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers['authorization'];
  if (!INTERNAL_API_KEY || auth !== `Bearer ${INTERNAL_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { documentId } = req.body as { documentId?: string };
  if (!documentId) {
    return res.status(400).json({ error: 'documentId required' });
  }

  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { text: true, filename: true },
  });

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  return res.status(200).json({
    text: document.text ?? null,
    filename: document.filename ?? null,
  });
}

export default withErrorReporting(handler);
