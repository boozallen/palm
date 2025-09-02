import logger from '@/server/logger';
import { KnowledgeBase } from '@/features/shared/types';
import db from '@/server/db';

type UpdateKnowledgeBaseInput = Omit<KnowledgeBase, 'kbProviderId' | 'createdAt' | 'updatedAt'>;

export default async function updateKnowledgeBase(input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
  try {
    const updatedKnowledgeBase = await db.knowledgeBase.update({
      where: {
        id: input.id,
      },
      data: {
        label: input.label,
        externalId: input.externalId,
      },
    });

    return {
      id: updatedKnowledgeBase.id,
      label: updatedKnowledgeBase.label,
      externalId: updatedKnowledgeBase.externalId,
      kbProviderId: updatedKnowledgeBase.kbProviderId,
      createdAt: updatedKnowledgeBase.createdAt,
      updatedAt: updatedKnowledgeBase.updatedAt,
    };
  } catch (error) {
    logger.error('Error updating knowledge base', error);
    throw new Error('Error updating knowledge base');
  }
}
