import db from '@/server/db';
import logger from '@/server/logger';

// The set of AI providers with at least one embeddings-only model, system-wide.
// Paired against a user's group memberships client-side to determine which of
// their groups actually grant embedding access, mirroring how chat/playground
// narrow group eligibility by a chosen model's aiProviderId.
export default async function getEmbeddingEligibleAiProviderIds(): Promise<string[]> {
  try {
    const results = await db.model.findMany({
      where: {
        deletedAt: null,
        embeddingsOnly: true,
        aiProvider: { deletedAt: null },
      },
      select: { aiProviderId: true },
      distinct: ['aiProviderId'],
    });

    return results.map((result) => result.aiProviderId);
  } catch (error) {
    logger.error('Error fetching embedding-eligible AI providers', error);
    throw new Error('Error fetching embedding-eligible AI providers');
  }
}
