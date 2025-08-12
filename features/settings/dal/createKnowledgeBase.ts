import db from '@/server/db';
import logger from '@/server/logger';
import { KnowledgeBase } from '@/features/shared/types/knowledge-base';

type CreateKnowledgeBaseInput = {
  label: string;
  externalId: string;
  kbProviderId: string;
};

/**
 * Creates a new knowledge base
 * @param input - The knowledge base to create
 * @returns The created knowledge base
 */
export default async function createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {

  try {
    const response = await db.knowledgeBase.create({
      data: {
        label: input.label,
        externalId: input.externalId,
        kbProviderId: input.kbProviderId,
      },
    });

    const result: KnowledgeBase = {
      id: response.id,
      label: response.label,
      externalId: response.externalId,
      kbProviderId: response.kbProviderId,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };

    return result;

  } catch (error) {
    logger.error('Error creating knowledge base', error);
    throw new Error('Error creating knowledge base');
  }
};
