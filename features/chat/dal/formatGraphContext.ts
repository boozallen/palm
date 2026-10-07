import { GraphContext } from '@/features/chat/dal/buildGraphContext';
import { OneHopResult, ShortestPathResult } from '@/features/graph-database/services/graphQueries';
import { Citation, ContextType } from '@/features/chat/types/message';

interface AggregatedNeighbor {
  neighbor: {
    id: string;
    name?: string;         // Optional - Chunks don't have names
    description?: string;  // For Chunks, this is the summary
    type?: string;
  };
  relationships: Array<{
    type: string;
    sourceName: string;
    targetName: string;
    description?: string;
    context?: string;      // Mention/discussion context (for Chunk neighbors)
  }>;
}

/**
 * Format graph context for LLM consumption
 *
 * Follows LightRAG's neighbor-centric approach:
 * - Anchors section: entities, concepts, chunks that matched via semantic search
 * - Connected Context section: one-hop neighbors with deduplicated relationships
 *
 * @param context - The graph context with entities, concepts, chunks, and oneHopResults
 * @param chunkSummaries - Optional map of embeddingId -> summary for displaying summaries instead of full content
 * @returns Formatted string for LLM context, or empty string if no content
 */
export function formatGraphContextForLLM(
  context: GraphContext,
  chunkSummaries?: Map<string, string>
): string {
  // Edge case: Completely empty context
  if (
    context.entities.length === 0 &&
    context.concepts.length === 0 &&
    context.chunks.length === 0 &&
    context.oneHopResults.length === 0
  ) {
    return '';
  }

  const sections: string[] = [];
  sections.push('## Semantic Search Context:');

  const anchorsSection = formatAnchorsSection(context, chunkSummaries);
  if (anchorsSection) {
    sections.push('\n### Semantic Matches:\n' + anchorsSection);
  }

  if (context.oneHopResults.length > 0) {
    const connectedSection = formatConnectedContextSection(context.oneHopResults);
    sections.push('\n### One-Hop Expansion:\n' + connectedSection);
  }

  if (context.shortestPaths?.length > 0) {
    sections.push('\n### Connection Paths:\n' + formatShortestPathsSection(context.shortestPaths));
  }

  return sections.join('\n');
}

/**
 * Format anchors section with entities, concepts, and chunks
 * Uses chunk summaries when available, falls back to full content
 */
function formatAnchorsSection(
  context: GraphContext,
  chunkSummaries?: Map<string, string>
): string {
  const lines: string[] = [];

  for (const e of context.entities) {
    let line = `**${e.entityName}** (ENTITY)`;
    if (e.description) {
      line += `: ${e.description}`;
    }
    lines.push(line);
  }

  for (const c of context.concepts) {
    let line = `**${c.conceptName}** (CONCEPT)`;
    if (c.description) {
      line += `: ${c.description}`;
    }
    lines.push(line);
  }

  for (const chunk of context.chunks) {
    // Use summary if available, otherwise fall back to full citation content
    let displayText = chunk.citation;

    if (chunkSummaries && chunk.contextType === ContextType.DOCUMENT_LIBRARY) {
      const docChunk = chunk as Citation & { embeddingId?: string };
      if (docChunk.embeddingId && chunkSummaries.has(docChunk.embeddingId)) {
        displayText = chunkSummaries.get(docChunk.embeddingId)!;
      }
    }

    lines.push(`**${chunk.sourceLabel}** (CHUNK): "${displayText}"`);
  }

  return lines.join('\n\n');
}

/**
 * Format connected context section with deduplicated neighbors
 * Each neighbor appears once with all its relationships aggregated
 * Sorted by connection count (most connected first)
 *
 * Handles Chunk neighbors specially:
 * - No name field, uses type "Chunk"
 * - description contains the chunk summary
 * - relationship.context contains the mention/discussion context
 */
function formatConnectedContextSection(oneHopResults: OneHopResult[]): string {
  // Deduplicate and aggregate by neighbor
  const byNeighborId = new Map<string, AggregatedNeighbor>();

  for (const result of oneHopResults) {
    const key = result.neighbor.id;
    if (!byNeighborId.has(key)) {
      byNeighborId.set(key, { neighbor: result.neighbor, relationships: [] });
    }
    byNeighborId.get(key)!.relationships.push({
      type: result.relationship.type,
      sourceName: result.relationship.sourceName,
      targetName: result.relationship.targetName,
      description: result.relationship.description,
      context: result.relationship.context,
    });
  }

  // Sort by connection count (most connected first)
  const sorted = Array.from(byNeighborId.values())
    .sort((a, b) => b.relationships.length - a.relationships.length);

  const lines: string[] = [];
  for (const { neighbor, relationships } of sorted) {
    const isChunk = neighbor.type === 'Chunk';

    // Format header based on neighbor type
    let header: string;
    if (isChunk) {
      // Chunk neighbors: show type and summary (no name)
      header = `**Chunk** (${neighbor.type})`;
      if (neighbor.description) {
        header += `: "${neighbor.description}"`;
      }
    } else {
      // Entity/Concept neighbors: show name and description
      header = `**${neighbor.name || 'Unknown'}**`;
      if (neighbor.type) {
        header += ` (${neighbor.type})`;
      }
      if (neighbor.description) {
        header += `: ${neighbor.description}`;
      }
    }
    lines.push(header);

    // Format relationships
    for (const rel of relationships) {
      lines.push(`  - Relationship: ${rel.type}`);
      lines.push(`    Source: ${rel.sourceName}, Target: ${rel.targetName}`);
      if (rel.description) {
        lines.push(`    Description: "${rel.description}"`);
      }
      // Show mention/discussion context for chunk relationships
      if (rel.context) {
        lines.push(`    Context: "${rel.context}"`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format shortest path results for LLM context.
 * Each path uses the pre-formatted string from findShortestPaths.
 */
function formatShortestPathsSection(paths: ShortestPathResult[]): string {
  return paths.map((p) => p.formatted).join('\n\n');
}
