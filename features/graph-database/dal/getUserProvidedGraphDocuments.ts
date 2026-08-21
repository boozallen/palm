import db from '@/server/db';
import logger from '@/server/logger';
import { tryParsePalmGraph } from '@/features/graph-database/services/jsonIngest/detectPalmGraph';

/**
 * Returns the IDs of the user's accessible documents that are valid native
 * palm-graph (JSON) files — i.e. they will be ingested as a user-provided graph
 * rather than run through LLM extraction at build time. Uses the exact same
 * detection the build worker uses (`tryParsePalmGraph`), so the picker's
 * "Build type" always matches what the worker will actually do.
 *
 * Only `.json` documents are read (their text holds the graph), bounding the
 * cost of inspecting document text.
 */
export default async function getUserProvidedGraphDocuments(userId: string): Promise<string[]> {
  try {
    const candidates = await db.document.findMany({
      where: {
        filename: { endsWith: '.json', mode: 'insensitive' },
        OR: [
          { userId },
          { adminCreated: true, accessUsers: { some: { id: userId } } },
        ],
      },
      select: { id: true, text: true },
    });

    return candidates
      .filter((doc) => tryParsePalmGraph(doc.text))
      .map((doc) => doc.id);
  } catch (error) {
    logger.error('Error detecting user-provided graph documents', { userId, error });
    throw new Error('Error detecting user-provided graph documents');
  }
}
