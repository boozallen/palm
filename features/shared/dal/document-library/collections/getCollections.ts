import db from '@/server/db';
import logger from '@/server/logger';

type GetCollectionsInput = {
  userId: string;
};

export default async function getCollections(input: GetCollectionsInput) {
  try {
    const collections = await db.documentCollection.findMany({
      // The user's own collections, plus any `shared` collection that holds at
      // least one document they can access (their own or an admin-shared doc via
      // accessUsers). The access guard keeps an empty / no-access shared folder
      // from ever leaking to a recipient.
      where: {
        OR: [
          { userId: input.userId },
          {
            adminCreated: true,
            memberships: {
              some: {
                document: {
                  OR: [
                    { userId: input.userId },
                    { adminCreated: true, accessUsers: { some: { id: input.userId } } },
                  ],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        color: true,
        userId: true,
        adminCreated: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return collections.map(collection => ({
      id: collection.id,
      name: collection.name,
      color: collection.color,
      userId: collection.userId,
      shared: collection.adminCreated,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      // NOTE: counts ALL memberships, so for a recipient this can exceed the
      // number of docs they can actually see in the shared folder. Recipient
      // -facing UI derives its own count from visible docs (see ExpandedSourcesList).
      documentCount: collection._count.memberships,
    }));
  } catch (error) {
    logger.error('Error getting document collections', error);
    throw new Error('Error getting document collections');
  }
}
