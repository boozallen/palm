import { logger } from '@/server/logger';
import { UnionFind } from '@/features/graph-database/utils/unionFind';

/**
 * Blocking — pure graph functions that pre-partition candidate nodes into
 * disjoint blocks BEFORE any LLM call.
 *
 * Pipeline: buildCandidateGraph → applyMutualKnn → removeHubs → formBlocks →
 * splitOversizedBlocks. No I/O except observability logging; outputs are a
 * deterministic function of the inputs (UnionFind is insertion-order stable).
 */

/** An undirected candidate edge between two node ids with their cosine. */
export interface CandidateEdge {
  a: string;
  b: string;
  similarity: number;
}

/** Undirected weighted adjacency: node id -> (neighbor id -> similarity). */
export type KnnGraph = Map<string, Map<string, number>>;

/** A block is a set of node ids decided together by one resolveBlock pass. */
export type Block = string[];

/**
 * Build an undirected weighted graph from candidate edges. Every endpoint
 * becomes a node, so a node connected only to a later-removed neighbor still
 * survives as a (possibly isolated) graph node rather than vanishing.
 */
export function buildCandidateGraph(edges: CandidateEdge[]): KnnGraph {
  const graph: KnnGraph = new Map();
  const ensure = (id: string): Map<string, number> => {
    let adj = graph.get(id);
    if (!adj) {
      adj = new Map();
      graph.set(id, adj);
    }
    return adj;
  };

  for (const { a, b, similarity } of edges) {
    if (a === b) {
      continue;
    }
    const adjA = ensure(a);
    const adjB = ensure(b);
    // Keep the strongest observed similarity for a duplicated edge.
    adjA.set(b, Math.max(adjA.get(b) ?? 0, similarity));
    adjB.set(a, Math.max(adjB.get(a) ?? 0, similarity));
  }

  return graph;
}

/**
 * Mutual-KNN filter: keep an edge only if it is reciprocal in the directed
 * neighbor sets of nodes that originated a candidate search. An edge between
 * two origin nodes survives only if each lists the other; an edge with a
 * non-origin endpoint (an existing node that never searched) is kept, since it
 * cannot be expected to reciprocate. Reduces single-linkage chaining.
 */
export function applyMutualKnn(
  graph: KnnGraph,
  originNeighbors: Map<string, Set<string>>
): KnnGraph {
  const kept: CandidateEdge[] = [];
  const survivors = new Set<string>();

  for (const [a, adj] of graph) {
    for (const [b, similarity] of adj) {
      if (a >= b) {
        continue; // visit each undirected edge once
      }
      const aIsOrigin = originNeighbors.has(a);
      const bIsOrigin = originNeighbors.has(b);

      let keep: boolean;
      if (aIsOrigin && bIsOrigin) {
        keep = !!originNeighbors.get(a)?.has(b) && !!originNeighbors.get(b)?.has(a);
      } else {
        keep = true; // one endpoint never originated a search → can't reciprocate
      }

      if (keep) {
        kept.push({ a, b, similarity });
        survivors.add(a);
        survivors.add(b);
      }
    }
  }

  const next = buildCandidateGraph(kept);
  // Preserve nodes that lost all their edges as isolated graph nodes.
  for (const id of graph.keys()) {
    if (!next.has(id)) {
      next.set(id, new Map());
    }
  }
  return next;
}

export interface RemoveHubsOptions {
  degreePercentile: number;
  /** Normalized generic/pronoun names whose nodes are dropped (anti-fusion). */
  genericNames: Set<string>;
  /** node id -> normalized name, for generic-term matching. */
  normalizedNameById: Map<string, string>;
}

/**
 * Remove hub and generic-term nodes before clustering so they cannot fuse
 * otherwise-unrelated blocks. A node is removed if its degree is strictly above
 * the degree percentile, or its normalized name is a generic/pronoun term.
 * Returns the pruned graph and the removed ids (caller logs counts — no silent
 * caps).
 */
export function removeHubs(
  graph: KnnGraph,
  opts: RemoveHubsOptions
): { graph: KnnGraph; removed: string[] } {
  const degrees = [...graph.values()].map((adj) => adj.size);
  const degreeCutoff = quantile(degrees, opts.degreePercentile);

  const removed: string[] = [];
  for (const [id, adj] of graph) {
    const name = opts.normalizedNameById.get(id);
    const isGeneric = name !== undefined && opts.genericNames.has(name);
    const isHub = adj.size > degreeCutoff;
    if (isGeneric || isHub) {
      removed.push(id);
    }
  }

  const removedSet = new Set(removed);
  const next: KnnGraph = new Map();
  for (const [id, adj] of graph) {
    if (removedSet.has(id)) {
      continue;
    }
    const keptAdj = new Map<string, number>();
    for (const [n, sim] of adj) {
      if (!removedSet.has(n)) {
        keptAdj.set(n, sim);
      }
    }
    next.set(id, keptAdj);
  }

  return { graph: next, removed };
}

/** Connected components via union-find. Isolated nodes are size-1 blocks. */
export function formBlocks(graph: KnnGraph): Block[] {
  const uf = new UnionFind<string>();
  for (const [id, adj] of graph) {
    uf.add(id); // ensure isolated nodes are represented
    for (const n of adj.keys()) {
      uf.union(id, n);
    }
  }
  return uf.groups();
}

/**
 * Recursively split blocks larger than maxBlockSize by tightening the
 * similarity cutoff (raise it to the next distinct edge weight and recompute
 * components). A block that cannot be reduced by thresholding (e.g. an
 * equal-weight clique) is logged and kept as-is rather than silently dropped.
 */
export function splitOversizedBlocks(
  blocks: Block[],
  graph: KnnGraph,
  opts: { maxBlockSize: number }
): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    out.push(...splitOne(block, graph, opts.maxBlockSize, 0));
  }
  return out;
}

function splitOne(
  block: Block,
  graph: KnnGraph,
  maxBlockSize: number,
  cutoff: number
): Block[] {
  if (block.length <= maxBlockSize) {
    return [block];
  }

  const blockSet = new Set(block);
  const induced = inducedEdges(block, blockSet, graph, cutoff);

  // Recompute components over the surviving (≥ cutoff) induced edges.
  const uf = new UnionFind<string>();
  block.forEach((id) => uf.add(id));
  for (const { a, b } of induced) {
    uf.union(a, b);
  }
  const components = uf.groups();

  if (components.length > 1) {
    return components.flatMap((c) => splitOne(c, graph, maxBlockSize, cutoff));
  }

  // Still one component — raise the cutoff to the next distinct edge weight.
  const nextCutoff = smallestSimilarityAbove(induced, cutoff);
  if (nextCutoff === null) {
    logger.warn('[RESOLUTION-V2] Oversized block could not be reduced by thresholding', {
      blockSize: block.length,
      maxBlockSize,
      cutoff,
    });
    return [block];
  }
  return splitOne(block, graph, maxBlockSize, nextCutoff);
}

function inducedEdges(
  block: Block,
  blockSet: Set<string>,
  graph: KnnGraph,
  cutoff: number
): CandidateEdge[] {
  const edges: CandidateEdge[] = [];
  for (const a of block) {
    const adj = graph.get(a);
    if (!adj) {
      continue;
    }
    for (const [b, sim] of adj) {
      if (a < b && blockSet.has(b) && sim >= cutoff) {
        edges.push({ a, b, similarity: sim });
      }
    }
  }
  return edges;
}

function smallestSimilarityAbove(edges: CandidateEdge[], cutoff: number): number | null {
  let best: number | null = null;
  for (const { similarity } of edges) {
    if (similarity > cutoff && (best === null || similarity < best)) {
      best = similarity;
    }
  }
  return best;
}

/** Linear-interpolation quantile of a numeric sample (0 for empty input). */
export function quantile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return sorted[0];
  }
  const pos = (sorted.length - 1) * Math.min(Math.max(p, 0), 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) {
    return sorted[lo];
  }
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
