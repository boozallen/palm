import db from '@/server/db';
import logger from '@/server/logger';

type CreateCollectionInput = {
  name: string;
  color?: string;
  userId: string;
};

export default async function createCollection(input: CreateCollectionInput) {
  try {
    const collection = await db.documentCollection.create({
      data: {
        name: input.name,
        color: input.color || '#228BE6',
        userId: input.userId,
      },
    });

    return collection;
  } catch (error) {
    logger.error('Error creating document collection', error);
    throw new Error('Error creating document collection');
  }
}
