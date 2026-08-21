import { logger } from '@/server/logger';
import { signalsConfig } from '@/features/graph-database/config/signals.config';
import { GRAPH_BUILD_LLM_REQUEST_TIMEOUT_MS } from '@/features/graph-database/config/graph-build.config';
import { searchCandidatesExact, type CandidateRow } from '@/features/graph-database/dal/candidateSearchExact';
import { getIdentityClusters, type IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';
import { computeAllSignals } from '@/features/graph-database/services/signalComputation';
import { computeConceptSignals, meetsResolutionRules } from '@/features/graph-database/services/candidateGeneration';
import {
  buildCandidateGraph,
  applyMutualKnn,
  removeHubs,
  formBlocks,
  splitOversizedBlocks,
  type CandidateEdge,
  type KnnGraph,
} from '@/features/graph-database/services/blocking';
import { resolveBlock, type ResolveBlockContext } from '@/features/graph-database/services/clusterResolution';
import {
  closeIdentityClusters,
  maintainClusterHubs,
} from '@/features/graph-database/services/confirmedEdgeClustering';
import { selectClusterRepresentatives } from '@/features/graph-database/services/clusterRepresentatives';
import type { Entity, Concept, Resolution, ConceptCategory } from '@/features/graph-database/types';

/**
 * Concepts carry 'category'; entities carry 'type'. (Matches the private guard
 * duplicated across resolutionExecutor/resolutionPrompt/worker.)
 */
function isConceptNode(node: Entity | Concept): node is Concept {
  return 'category' in node && !('type' in node);
}

export interface ResolveEntitiesV2Params {
  newNodes: Array<Entity | Concept>;
  existingNodes: Array<Entity | Concept>;
  userId: string;
  scope: 'document' | 'user';
  /** Checked between blocks; when it resolves true the block loop stops early
   * (breaks, does not throw — blocks already decided persist normally). */
  shouldCancel?: () => Promise<boolean>;
}

/**
 * Resolution orchestrator: candidate gen → blocking → cluster decision →
 * confirmed-edge closure. Returns the `Resolution[]` that `persistResolutions`
 * consumes, plus `failedCalls` — the number of blocks left UNDECIDED because
 * their LLM call failed after retries. A non-zero count means the run is
 * incomplete and its documents must not be marked resolution-complete.
 *
 * Entities and concepts are resolved in SEPARATE passes (never mixed in a
 * block). The AI source is built once and shared across all blocks.
 */
export async function resolveEntitiesV2(
  params: ResolveEntitiesV2Params
): Promise<{ resolutions: Resolution[]; failedCalls: number }> {
  const { newNodes, existingNodes, userId, scope, shouldCancel } = params;

  const newEntities = newNodes.filter((n): n is Entity => !isConceptNode(n));
  const newConcepts = newNodes.filter((n): n is Concept => isConceptNode(n));
  const existingEntities = existingNodes.filter((n): n is Entity => !isConceptNode(n));
  const existingConcepts = existingNodes.filter((n): n is Concept => isConceptNode(n));

  logger.info('[RESOLUTION-V2] Starting V2 resolution', {
    scope,
    newEntities: newEntities.length,
    newConcepts: newConcepts.length,
    existingEntities: existingEntities.length,
    existingConcepts: existingConcepts.length,
  });

  // Frozen clusters (all user IDENTITY groups) — used by both passes; concept
  // clusters are inert in the entity pass and vice versa (ids are disjoint).
  const frozenClusters = await getIdentityClusters(userId);

  // CRITICAL: dynamic import to avoid circular dependency (mirrors resolutionExecutor).
  const { AIFactory } = await import('@/features/ai-provider/factory');
  const { source: aiProvider, model } = await new AIFactory({ userId }).buildKnowledgeGraphSource({
    requestTimeoutMs: GRAPH_BUILD_LLM_REQUEST_TIMEOUT_MS,
  });

  // One counter shared by both passes: a failure in either trips the gate.
  const resolutionFailures = { count: 0 };

  const entityResolutions = await runPass(
    newEntities,
    existingEntities,
    false,
    userId,
    frozenClusters,
    aiProvider,
    model,
    resolutionFailures,
    shouldCancel
  );
  const conceptResolutions = await runPass(
    newConcepts,
    existingConcepts,
    true,
    userId,
    frozenClusters,
    aiProvider,
    model,
    resolutionFailures,
    shouldCancel
  );

  const all = [...entityResolutions, ...conceptResolutions];
  logger.info('[RESOLUTION-V2] V2 resolution complete', {
    entityEdges: entityResolutions.length,
    conceptEdges: conceptResolutions.length,
    total: all.length,
    failedCalls: resolutionFailures.count,
  });
  return { resolutions: all, failedCalls: resolutionFailures.count };
}

/** Resolve one node type end-to-end and return its Resolution[] (+ bridges). */
async function runPass(
  newNodes: Array<Entity | Concept>,
  existingNodes: Array<Entity | Concept>,
  isConcept: boolean,
  userId: string,
  frozenClusters: IdentityCluster[],
  aiProvider: any,
  model: any,
  resolutionFailures: { count: number },
  shouldCancel?: () => Promise<boolean>
): Promise<Resolution[]> {
  // Resolution originates only from new nodes; an empty new set is a no-op.
  // No LLM call is made, so the failure counter correctly stays untouched.
  if (newNodes.length === 0) {
    return [];
  }

  const newNodeIds = new Set(newNodes.map((n) => n.id));

  // memberId -> hub id, derived from the (now hub-backed) frozen clusters.
  // Used both to anchor block resolution (frozenClusterByMember, below) and
  // to collapse surfaced candidates to one representative per hub.
  const hubByMember = new Map<string, string>();
  const frozenClusterByMember = new Map<string, IdentityCluster>();
  for (const cluster of frozenClusters) {
    for (const memberId of cluster.memberIds) {
      hubByMember.set(memberId, cluster.representativeId);
      frozenClusterByMember.set(memberId, cluster);
    }
  }

  const { edges, originNeighbors, nodeById } = await collectCandidateEdges(
    newNodes,
    existingNodes,
    isConcept,
    userId,
    hubByMember,
    newNodeIds
  );

  // Blocking pipeline.
  let graph: KnnGraph = buildCandidateGraph(edges);
  if (signalsConfig.blocking.mutualKnn) {
    graph = applyMutualKnn(graph, originNeighbors);
  }

  const genericNames = new Set<string>([
    ...signalsConfig.aliasFilters.pronouns.map((p) => p.toLowerCase().trim()),
    ...signalsConfig.aliasFilters.genericTerms.map((t) => t.toLowerCase().trim()),
  ]);
  const normalizedNameById = new Map<string, string>();
  for (const id of graph.keys()) {
    const node = nodeById.get(id);
    if (node) {
      normalizedNameById.set(id, normalizedNameOf(node, isConcept));
    }
  }

  const { graph: prunedGraph, removed } = removeHubs(graph, {
    degreePercentile: signalsConfig.blocking.hubDegreePercentile,
    genericNames,
    normalizedNameById,
  });
  if (removed.length > 0) {
    logger.info('[RESOLUTION-V2] Removed hub/generic nodes before clustering', {
      isConcept,
      removedCount: removed.length,
      removedNames: removed.map((id) => nodeById.get(id)?.name ?? id),
    });
  }

  let blocks = formBlocks(prunedGraph);
  blocks = splitOversizedBlocks(blocks, prunedGraph, {
    maxBlockSize: signalsConfig.blocking.maxBlockSize,
  });

  logger.info('[RESOLUTION-V2] Built blocks', {
    isConcept,
    candidateEdges: edges.length,
    blockCount: blocks.length,
    multiNodeBlocks: blocks.filter((b) => b.length > 1).length,
  });

  // Decision.
  const ctx: ResolveBlockContext = {
    nodeById,
    graph: prunedGraph,
    newNodeIds,
    frozenClusterByMember,
    isConcept,
    aiProvider,
    model,
    resolutionFailures,
  };

  const resolutions: Resolution[] = [];
  for (const block of blocks) {
    if (shouldCancel && (await shouldCancel())) {
      logger.info('[RESOLUTION-V2] Resolution cancelled between blocks', { isConcept });
      break;
    }
    resolutions.push(...(await resolveBlock(block, ctx)));
  }

  // Consistency: connected-component closure over confirmed IDENTITY edges,
  // emitting free bridging edges so clusters stay transitively consistent.
  const { mergedClusters, bridgingEdges } = closeIdentityClusters(resolutions, frozenClusters);
  if (bridgingEdges.length > 0) {
    logger.info('[RESOLUTION-V2] Emitting free bridging IDENTITY edges', {
      isConcept,
      bridgingEdges: bridgingEdges.length,
    });
  }

  // Maintain :IdentityCluster hubs alongside the :IDENTITY audit trail above.
  await maintainClusterHubs(mergedClusters, userId);

  return [...resolutions, ...bridgingEdges];
}

/**
 * Generate the candidate edges for one node type: per new node, exact-cosine +
 * name/alias search, kept only if the pair meets the resolution rules — then
 * collapsed to one representative per `:IdentityCluster` hub.
 *
 * Two phases, deliberately not interleaved:
 *  - Phase A (recall-defining): search + `meetsResolutionRules` gate on RAW
 *    rows. Collapse must never influence which candidates survive this gate.
 *  - Phase B: `selectClusterRepresentatives` over every Phase-A survivor,
 *    then edges/originNeighbors are built against representative ids.
 */
export async function collectCandidateEdges(
  newNodes: Array<Entity | Concept>,
  existingNodes: Array<Entity | Concept>,
  isConcept: boolean,
  userId: string,
  hubByMember: Map<string, string>,
  newNodeIds: Set<string>
): Promise<{
  edges: CandidateEdge[];
  originNeighbors: Map<string, Set<string>>;
  nodeById: Map<string, Entity | Concept>;
}> {
  const nodeById = new Map<string, Entity | Concept>();
  [...existingNodes, ...newNodes].forEach((n) => nodeById.set(n.id, n));

  const threshold = signalsConfig.blocking.similarityThreshold;

  interface Survivor {
    sourceId: string;
    candidate: Entity | Concept;
    similarity: number;
  }
  const survivors: Survivor[] = [];

  for (const source of newNodes) {
    const rows = await searchCandidatesExact(source, { userId, threshold, isConcept });

    for (const row of rows) {
      const candidate = resolveCandidateNode(row, nodeById, isConcept);
      const signals = isConcept
        ? computeConceptSignals(source as Concept, candidate as Concept, row.similarity)
        : computeAllSignals(source as Entity, candidate as Entity, row.similarity);

      // Same resolution-rule gate as the legacy path (name / alias / embedding).
      if (!meetsResolutionRules(signals)) {
        continue;
      }
      survivors.push({ sourceId: source.id, candidate, similarity: row.similarity });
    }
  }

  const { representativeByMember, representativeNodeById, stats } = selectClusterRepresentatives({
    surfaced: survivors.map(({ candidate, similarity }) => ({ node: candidate, similarity })),
    hubByMember,
    newNodeIds,
    isConcept,
  });
  // nodeById must hold the ENRICHED representative under the representative
  // id — resolveBlock looks nodes up there, and that is what reaches the prompt.
  for (const [repId, repNode] of representativeNodeById) {
    nodeById.set(repId, repNode);
  }
  if (stats.clustersCollapsed > 0) {
    logger.info('[RESOLUTION-V2] Collapsed surfaced candidates to cluster representatives', {
      isConcept,
      ...stats,
    });
  }

  const edges: CandidateEdge[] = [];
  const originNeighbors = new Map<string, Set<string>>();
  for (const node of newNodes) {
    originNeighbors.set(node.id, new Set());
  }
  const seenPairs = new Set<string>();

  for (const { sourceId, candidate, similarity } of survivors) {
    const targetId = representativeByMember.get(candidate.id) ?? candidate.id;
    if (targetId === sourceId) {
      continue; // defensive: a source's representative must never resolve to itself
    }
    originNeighbors.get(sourceId)!.add(targetId);

    const pairKey = [sourceId, targetId].sort().join('|');
    if (seenPairs.has(pairKey)) {
      continue;
    }
    seenPairs.add(pairKey);
    edges.push({ a: sourceId, b: targetId, similarity });
  }

  return { edges, originNeighbors, nodeById };
}

/** Use the rich new-node object if known, else reconstruct from the row. */
function resolveCandidateNode(
  row: CandidateRow,
  nodeById: Map<string, Entity | Concept>,
  isConcept: boolean
): Entity | Concept {
  const existing = nodeById.get(row.id);
  if (existing) {
    return existing;
  }
  const node = isConcept ? rowToConcept(row) : rowToEntity(row);
  nodeById.set(row.id, node);
  return node;
}

function rowToEntity(row: CandidateRow): Entity {
  return {
    id: row.id,
    name: row.name,
    type: row.type ?? '',
    normalizedName: row.normalizedName ?? row.name.toLowerCase().trim(),
    description: row.description,
    aliases: row.aliases,
    documentId: row.documentId,
    mentionCount: 0,
    firstSeenAt: new Date(0),
  };
}

function rowToConcept(row: CandidateRow): Concept {
  return {
    id: row.id,
    name: row.name,
    category: (row.category ?? 'GENERAL') as ConceptCategory,
    description: row.description,
    documentId: row.documentId,
    mentionCount: 0,
    firstSeenAt: new Date(0),
  };
}

function normalizedNameOf(node: Entity | Concept, isConcept: boolean): string {
  if (isConcept) {
    return node.name.toLowerCase().trim();
  }
  const entity = node as Entity;
  return (entity.normalizedName ?? entity.name).toLowerCase().trim();
}
