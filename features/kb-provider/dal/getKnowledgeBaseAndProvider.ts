import db from '@/server/db';
import logger from '@/server/logger';
import {
  KnowledgeBase,
  KbProvider,
  kbProviderConfigSchema,
 } from '@/features/shared/types';

type KnowledgeBaseAndProvider = {
  knowledgeBase: KnowledgeBase,
  kbProvider: KbProvider,
}

export default async function getKnowledgeBaseAndProvider(kbId: string): Promise<KnowledgeBaseAndProvider|null> {
  try {
    const knowledgeBaseRecord = await db.knowledgeBase.findUnique({
      where: { id: kbId, deletedAt: null },
      include: { kbProvider: true },
    });
    if (!knowledgeBaseRecord) {
      return null;
    }
    const {
      kbProvider: { config: providerConfig, ...providerRest },
      ...knowledgeBase
    } = knowledgeBaseRecord;
    const config = kbProviderConfigSchema.parse(providerConfig);
    const kbProvider = { config, ...providerRest };
    return { knowledgeBase, kbProvider };
  } catch (cause) {
    const msg = `Error fetching knowledge base ${kbId}`;
    logger.error(msg, cause);
    throw new Error(msg, { cause });
  }
}
