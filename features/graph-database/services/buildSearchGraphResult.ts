/**
 * Maps the entity/concept anchors returned by the `search` tool into the same
 * `GraphSearchResultData` contract that `cypher_query` already emits, so semantic
 * search hits render as an interactive table + anchor graph through the existing
 * worker/`GraphVisualization` pipeline.
 *
 * Pure transform with no DB/Neo4j access: each anchor becomes one table row, and
 * the row's Neo4j id is kept only in `nodeMapping` (never surfaced as a visible
 * column). The worker later turns the collected `nodeMapping.entityIds` into the
 * heavy `graphData` once at end-of-turn — this builder never touches the graph.
 */

import type { GraphSearchResultData } from '@/features/chat/types/message';
import type { NodeMappingEntry } from '@/features/graph-database/services/buildNodeMapping';

export interface EntityAnchor {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  documentId: string;
  score: number;
}

export interface ConceptAnchor {
  id: string;
  name: string;
  description: string;
  category: string;
  documentId: string;
  score: number;
}

export function buildSearchGraphResult(
  entities: EntityAnchor[],
  concepts: ConceptAnchor[],
  query: string,
): GraphSearchResultData | null {
  if (entities.length === 0 && concepts.length === 0) {
    return null;
  }

  const rows: Record<string, unknown>[] = [];
  const nodeMapping: NodeMappingEntry[] = [];

  // Visible columns only. The anchor's Neo4j id, retrieval score (RRF), and
  // documentId are deliberately omitted from the rendered rows — the id lives in
  // nodeMapping, and score/documentId are internal retrieval mechanics, not
  // user-facing.
  for (const entity of entities) {
    nodeMapping.push({ rowIndex: rows.length, entityIds: [entity.id] });
    rows.push({
      kind: 'Entity',
      name: entity.name,
      type: '',
      description: entity.description,
    });
  }

  for (const concept of concepts) {
    nodeMapping.push({ rowIndex: rows.length, entityIds: [concept.id] });
    rows.push({
      kind: 'Concept',
      name: concept.name,
      type: concept.category,
      description: concept.description,
    });
  }

  return {
    rows,
    nodeMapping,
    query,
    rowCount: entities.length + concepts.length,
    generatedCypher: '',
  };
}
