import { Prisma } from '@prisma/client';
import db from '@/server/db';
import { logger } from '@/server/logger';
import type { Entity, Concept } from '@/features/graph-database/types';

/**
 * A resolution candidate returned by the exact-cosine + name/alias search.
 *
 * Carries every field `computeAllSignals` / `computeConceptSignals` and the
 * cluster prompts need (name, type/category, normalizedName, aliases,
 * documentId, description, similarity) so the V2 path never has to round-trip
 * to Neo4j via `getEntityById` for the resolved fields.
 */
export interface CandidateRow {
  id: string;
  name: string;
  type?: string;              // entities only
  category?: string;          // concepts only
  normalizedName: string | null;
  description: string;
  aliases: string[];          // [] for concepts
  documentId: string;
  similarity: number;         // cosine to the source (0.0-1.0)
}

interface CandidateSearchOptions {
  userId: string;
  threshold: number;
  isConcept: boolean;
}

/**
 * Find resolution candidates for a single source node using an exact,
 * user-pre-filtered scan — NOT HNSW.
 *
 * The result is the UNION of two arms, expressed as a single OR'd predicate so
 * each row is returned exactly once with its cosine already computed:
 *   1. Embedding arm — exact cosine `> threshold`, scoped to the user.
 *   2. Name/alias arm — same user scope where the (case-insensitive)
 *      normalized name matches, or the combined name+alias sets overlap;
 *      included regardless of embedding rank so guaranteed matches are never
 *      missed.
 *
 * Once scoped to one user the candidate pool is small, so the absence of an
 * `ORDER BY … LIMIT` yields a userId-filtered exact scan with perfect recall —
 * which matters because the threshold is the singleton/cluster gate.
 *
 * SINGLETON SAFETY: a node with no above-threshold neighbor and no name/alias
 * match returns `[]` (no candidate edges → no block → no LLM call).
 *
 * The name arm coalesces `normalizedName` to the raw name (lowered/trimmed —
 * the same derivation extraction uses), so rows written before the column was
 * populated still participate in exact-name recall.
 */
export async function searchCandidatesExact(
  source: Entity | Concept,
  opts: CandidateSearchOptions
): Promise<CandidateRow[]> {
  const { userId, threshold, isConcept } = opts;

  try {
    return isConcept
      ? await searchConceptCandidates(source.id, userId, threshold)
      : await searchEntityCandidates(source.id, userId, threshold);
  } catch (error) {
    logger.error('[RESOLUTION-V2] Exact candidate search failed', {
      sourceId: source.id,
      userId,
      isConcept,
      error,
    });
    throw new Error('Failed to search resolution candidates');
  }
}

async function searchEntityCandidates(
  sourceId: string,
  userId: string,
  threshold: number
): Promise<CandidateRow[]> {
  const query = Prisma.sql`
    SELECT
      e.id,
      e."entityName" AS name,
      e.type,
      e."normalizedName" AS "normalizedName",
      e.description,
      e.aliases,
      e."documentId" AS "documentId",
      1 - (e.embedding <=> source.embedding) AS similarity
    FROM graph_entity_embeddings source, graph_entity_embeddings e
    WHERE source.id = ${sourceId}::uuid
      AND e."userId" = ${userId}::uuid
      AND e.id <> ${sourceId}::uuid
      AND (
        (1 - (e.embedding <=> source.embedding)) > ${threshold}
        OR lower(trim(COALESCE(e."normalizedName", e."entityName")))
           = lower(trim(COALESCE(source."normalizedName", source."entityName")))
        OR (
          ARRAY(SELECT lower(x) FROM unnest(e.aliases || ARRAY[e."entityName"]) AS x)
          && ARRAY(SELECT lower(y) FROM unnest(source.aliases || ARRAY[source."entityName"]) AS y)
        )
      )
  `;

  const rows = await db.$queryRaw<Array<{
    id: string;
    name: string;
    type: string | null;
    normalizedName: string | null;
    description: string;
    aliases: string[];
    documentId: string;
    similarity: number;
  }>>(query);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type ?? undefined,
    normalizedName: r.normalizedName,
    description: r.description,
    aliases: r.aliases ?? [],
    documentId: r.documentId,
    similarity: r.similarity,
  }));
}

async function searchConceptCandidates(
  sourceId: string,
  userId: string,
  threshold: number
): Promise<CandidateRow[]> {
  const query = Prisma.sql`
    SELECT
      c.id,
      c."conceptName" AS name,
      c.category,
      c."normalizedName" AS "normalizedName",
      c.description,
      c."documentId" AS "documentId",
      1 - (c.embedding <=> source.embedding) AS similarity
    FROM graph_concept_embeddings source, graph_concept_embeddings c
    WHERE source.id = ${sourceId}::uuid
      AND c."userId" = ${userId}::uuid
      AND c.id <> ${sourceId}::uuid
      AND (
        (1 - (c.embedding <=> source.embedding)) > ${threshold}
        OR lower(trim(COALESCE(c."normalizedName", c."conceptName")))
           = lower(trim(COALESCE(source."normalizedName", source."conceptName")))
      )
  `;

  const rows = await db.$queryRaw<Array<{
    id: string;
    name: string;
    category: string;
    normalizedName: string | null;
    description: string;
    documentId: string;
    similarity: number;
  }>>(query);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    normalizedName: r.normalizedName,
    description: r.description,
    aliases: [],
    documentId: r.documentId,
    similarity: r.similarity,
  }));
}
