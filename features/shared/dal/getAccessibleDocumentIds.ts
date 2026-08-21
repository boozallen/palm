import db from '@/server/db';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

export default async function getAccessibleDocumentIds(userId: string): Promise<AccessibleDocIds> {
  try {
    const docs = await db.document.findMany({
      where: {
        OR: [
          { userId },
          { adminCreated: true, accessUsers: { some: { id: userId } } },
        ],
      },
      select: { id: true },
    });
    return new Set(docs.map((d) => d.id)) as unknown as AccessibleDocIds;
  } catch (error) {
    logger.error('Error fetching accessible document IDs', { userId, error });
    throw new Error('Error fetching accessible documents');
  }
}
