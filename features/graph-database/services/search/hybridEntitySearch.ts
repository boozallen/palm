import { getGraphDatabaseSource } from '@/features/graph-database';
import getEntitiesForQuery, { EntitySearchResult } from '@/features/chat/dal/getEntitiesForQuery';
import { buildLuceneOrQuery } from './luceneEscape';
import { reciprocalRankFusion } from './reciprocalRankFusion';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import { logger } from '@/server/logger';

export interface HybridEntitySearchParams {
  extractedTerms: string[];
  documentIds: string[];
  accessibleDocIds: AccessibleDocIds;
  embeddedQuery: number[];
  maxResults?: number;
}

const BM25_ENTITY_QUERY = `
  CALL db.index.fulltext.queryNodes('entity_name_fulltext', $searchTerm)
  YIELD node, score
  WHERE node.documentId IN $documentIds
  RETURN node.id as id, node.name as name, node.description as description,
         node.aliases as aliases, node.documentId as documentId
  ORDER BY score DESC
  LIMIT 25
`;

const EXACT_MATCH_QUERY = `
  UNWIND $terms AS term
  MATCH (e:Entity)
  WHERE e.documentId IN $documentIds
    AND (toLower(e.name) = toLower(term) OR any(a IN e.aliases WHERE toLower(a) = toLower(term)))
  RETURN DISTINCT e.id as id, e.name as name, e.description as description,
         e.aliases as aliases, e.documentId as documentId
`;

export async function hybridEntitySearch(params: HybridEntitySearchParams): Promise<EntitySearchResult[]> {
  if (params.extractedTerms.length === 0) {
    logger.debug('[HYBRID-SEARCH] No extracted terms, falling through to vector-only for entities');
    return getEntitiesForQuery({
      embeddedQuery: params.embeddedQuery,
      documentIds: params.documentIds,
      accessibleDocIds: params.accessibleDocIds,
      matchCount: params.maxResults ?? 10,
    });
  }

  const [exactResult, bm25Result, vectorResult] = await Promise.allSettled([
    (async () => {
      const result = await (await getGraphDatabaseSource()).run(EXACT_MATCH_QUERY, {
        terms: params.extractedTerms,
        documentIds: params.documentIds,
      });
      return result.records.map(r => ({
        id: r.get('id') as string,
        entityName: r.get('name') as string,
        description: (r.get('description') as string) ?? '',
        aliases: (r.get('aliases') as string[]) ?? [],
        documentId: r.get('documentId') as string,
        score: 0,
      }));
    })(),
    (async () => {
      const luceneQuery = buildLuceneOrQuery(params.extractedTerms);
      const result = await (await getGraphDatabaseSource()).run(BM25_ENTITY_QUERY, {
        searchTerm: luceneQuery,
        documentIds: params.documentIds,
      });
      return result.records.map(r => ({
        id: r.get('id') as string,
        entityName: r.get('name') as string,
        description: (r.get('description') as string) ?? '',
        aliases: (r.get('aliases') as string[]) ?? [],
        documentId: r.get('documentId') as string,
        score: 0,
      }));
    })(),
    getEntitiesForQuery({
      embeddedQuery: params.embeddedQuery,
      documentIds: params.documentIds,
      accessibleDocIds: params.accessibleDocIds,
      matchCount: 25,
    }),
  ]);

  const resultMap = new Map<string, EntitySearchResult>();
  if (vectorResult.status === 'fulfilled') {
    vectorResult.value.forEach(e => resultMap.set(e.id, e));
  }
  if (bm25Result.status === 'fulfilled') {
    bm25Result.value.forEach(e => {
      if (!resultMap.has(e.id)) { resultMap.set(e.id, e); }
    });
  }
  if (exactResult.status === 'fulfilled') {
    exactResult.value.forEach(e => {
      if (!resultMap.has(e.id)) { resultMap.set(e.id, e); }
    });
  }

  const bm25Ids = bm25Result.status === 'fulfilled' ? bm25Result.value.map(e => e.id) : [];
  const vectorIds = vectorResult.status === 'fulfilled' ? vectorResult.value.map(e => e.id) : [];

  if (bm25Result.status === 'rejected') {
    logger.warn('[HYBRID-SEARCH] BM25 entity search failed, using vector-only', { error: bm25Result.reason });
  }
  if (vectorResult.status === 'rejected') {
    logger.warn('[HYBRID-SEARCH] Vector entity search failed, using BM25-only', { error: vectorResult.reason });
  }
  if (exactResult.status === 'rejected') {
    logger.warn('[HYBRID-SEARCH] Exact match entity search failed, continuing without', { error: exactResult.reason });
  }

  // Guaranteed includes: exact name/alias matches always make it in
  const exactIds = new Set(exactResult.status === 'fulfilled' ? exactResult.value.map(e => e.id) : []);

  const listsToFuse = [bm25Ids, vectorIds].filter(l => l.length > 0);
  if (listsToFuse.length === 0 && exactIds.size === 0) { return []; }

  const fused = listsToFuse.length > 0 ? reciprocalRankFusion(listsToFuse) : [];
  const maxResults = params.maxResults ?? 10;

  // Build final list: exact matches first (guaranteed), then RRF-ranked results (deduped)
  const finalResults: EntitySearchResult[] = [];
  const seenIds = new Set<string>();

  // Add exact matches first with high synthetic score
  for (const id of exactIds) {
    const record = resultMap.get(id);
    if (record) {
      finalResults.push({ ...record, score: 1.0 });
      seenIds.add(id);
    }
  }

  // Fill remaining slots from RRF results
  for (const item of fused) {
    if (seenIds.has(item.id)) {continue;}
    if (finalResults.length >= maxResults) {break;}
    const record = resultMap.get(item.id);
    if (!record) {continue;}
    finalResults.push({ ...record, score: item.score });
    seenIds.add(item.id);
  }

  return finalResults;
}
