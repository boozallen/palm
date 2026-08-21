import { getGraphDatabaseSource } from '@/features/graph-database';
import getConceptsForQuery, { ConceptSearchResult } from '@/features/chat/dal/getConceptsForQuery';
import { buildLuceneOrQuery } from './luceneEscape';
import { reciprocalRankFusion } from './reciprocalRankFusion';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import { logger } from '@/server/logger';

export interface HybridConceptSearchParams {
  extractedTerms: string[];
  documentIds: string[];
  accessibleDocIds: AccessibleDocIds;
  embeddedQuery: number[];
  maxResults?: number;
}

const BM25_CONCEPT_QUERY = `
  CALL db.index.fulltext.queryNodes('concept_name_fulltext', $searchTerm)
  YIELD node, score
  WHERE node.documentId IN $documentIds
  RETURN node.id as id, node.name as name, node.description as description,
         node.category as category, node.documentId as documentId
  ORDER BY score DESC
  LIMIT 25
`;

const EXACT_MATCH_QUERY = `
  UNWIND $terms AS term
  MATCH (c:Concept)
  WHERE c.documentId IN $documentIds
    AND toLower(c.name) = toLower(term)
  RETURN DISTINCT c.id as id, c.name as name, c.description as description,
         c.category as category, c.documentId as documentId
`;

export async function hybridConceptSearch(params: HybridConceptSearchParams): Promise<ConceptSearchResult[]> {
  if (params.extractedTerms.length === 0) {
    logger.debug('[HYBRID-SEARCH] No extracted terms, falling through to vector-only for concepts');
    return getConceptsForQuery({
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
        conceptName: r.get('name') as string,
        description: (r.get('description') as string) ?? '',
        category: (r.get('category') as string) ?? '',
        documentId: r.get('documentId') as string,
        score: 0,
      }));
    })(),
    (async () => {
      const luceneQuery = buildLuceneOrQuery(params.extractedTerms);
      const result = await (await getGraphDatabaseSource()).run(BM25_CONCEPT_QUERY, {
        searchTerm: luceneQuery,
        documentIds: params.documentIds,
      });
      return result.records.map(r => ({
        id: r.get('id') as string,
        conceptName: r.get('name') as string,
        description: (r.get('description') as string) ?? '',
        category: (r.get('category') as string) ?? '',
        documentId: r.get('documentId') as string,
        score: 0,
      }));
    })(),
    getConceptsForQuery({
      embeddedQuery: params.embeddedQuery,
      documentIds: params.documentIds,
      accessibleDocIds: params.accessibleDocIds,
      matchCount: 25,
    }),
  ]);

  const resultMap = new Map<string, ConceptSearchResult>();
  if (vectorResult.status === 'fulfilled') {
    vectorResult.value.forEach(c => resultMap.set(c.id, c));
  }
  if (bm25Result.status === 'fulfilled') {
    bm25Result.value.forEach(c => {
      if (!resultMap.has(c.id)) { resultMap.set(c.id, c); }
    });
  }
  if (exactResult.status === 'fulfilled') {
    exactResult.value.forEach(c => {
      if (!resultMap.has(c.id)) { resultMap.set(c.id, c); }
    });
  }

  const bm25Ids = bm25Result.status === 'fulfilled' ? bm25Result.value.map(c => c.id) : [];
  const vectorIds = vectorResult.status === 'fulfilled' ? vectorResult.value.map(c => c.id) : [];

  if (bm25Result.status === 'rejected') {
    logger.warn('[HYBRID-SEARCH] BM25 concept search failed, using vector-only', { error: bm25Result.reason });
  }
  if (vectorResult.status === 'rejected') {
    logger.warn('[HYBRID-SEARCH] Vector concept search failed, using BM25-only', { error: vectorResult.reason });
  }
  if (exactResult.status === 'rejected') {
    logger.warn('[HYBRID-SEARCH] Exact match concept search failed, continuing without', { error: exactResult.reason });
  }

  // Guaranteed includes: exact name matches always make it in
  const exactIds = new Set(exactResult.status === 'fulfilled' ? exactResult.value.map(c => c.id) : []);

  const listsToFuse = [bm25Ids, vectorIds].filter(l => l.length > 0);
  if (listsToFuse.length === 0 && exactIds.size === 0) { return []; }

  const fused = listsToFuse.length > 0 ? reciprocalRankFusion(listsToFuse) : [];
  const maxResults = params.maxResults ?? 10;

  // Build final list: exact matches first (guaranteed), then RRF-ranked results (deduped)
  const finalResults: ConceptSearchResult[] = [];
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
