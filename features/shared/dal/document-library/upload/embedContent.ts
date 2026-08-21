import { AIFactory } from '@/features/ai-provider/factory';
import { UsageAttribution } from '@/features/ai-provider/sources/AiProviderUsageTracker';

/**
 * Embeds content against the model an admin designated embeddings-only.
 *
 * modelId is optional so callers that already resolved the designated model — the
 * document upload worker checks availability before it starts extracting — can
 * pass it through instead of resolving it again per batch.
 *
 * attribution records what the embedding was for — a document being ingested, or
 * the chat message or workflow primitive whose retrieval triggered it — so its
 * spend can be totalled per artifact later. Callers that omit it write rows that
 * read as unattributed, which is honest: the link was never known.
 */
export const embedContent = async (
  content: string | string[],
  userId: string,
  modelId?: string,
  attribution?: UsageAttribution,
) => {
  const factory = new AIFactory({ userId });

  const { source, model } = await factory.buildEmbeddingSource(modelId, { attribution });

  const contentArray = Array.isArray(content) ? content : [content];

  const { embeddings } = await source.createEmbeddings(contentArray, {
    // The source invokes whatever externalId it is handed, so the designated
    // model has to be named here rather than left blank.
    model: model.externalId,
    temperature: 0.2,
    topP: 0.5,
    frequencyPenalty: 0,
    presencePenalty: 0,
  });

  return { embeddings };
};
