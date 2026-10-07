import { logger } from '@/server/logger';
import { retryWithBackoff } from '@/features/graph-database/utils/retryWithBackoff';
import { signalsConfig } from '@/features/graph-database/config/signals.config';
import { resolutionPolicy } from '@/features/graph-database/config/resolution-policy.config';
import {
  getEnabledEdgeTypes,
  getWorldKnowledgePolicy,
  validateEdgeTypeAllowed,
} from '@/features/graph-database/services/policyMatcher';
import { getSharedNames } from '@/features/graph-database/services/signalComputation';
import {
  buildPartitionPrompt,
  buildAnchorBatchPrompt,
  parseClusterResponse,
} from '@/features/graph-database/services/clusterResolutionPrompt';
import type { Block, KnnGraph } from '@/features/graph-database/services/blocking';
import type { IdentityCluster } from '@/features/graph-database/dal/getIdentityClusters';
import type { Entity, Concept, Resolution } from '@/features/graph-database/types';
import type { ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';

/**
 * Everything resolveBlock needs to decide one block. Built once per resolution
 * by the orchestrator and shared across every block.
 */
export interface ResolveBlockContext {
  /** id -> resolved node object (new full nodes preferred over candidate rows). */
  nodeById: Map<string, Entity | Concept>;
  /** Undirected pairwise cosine graph (for the cosineSimScore signal). */
  graph: KnnGraph;
  /** Ids of nodes from the new documents (the only edges we emit involve one). */
  newNodeIds: Set<string>;
  /** memberId -> its frozen cluster (existing :IDENTITY group). */
  frozenClusterByMember: Map<string, IdentityCluster>;
  /** Whether this block is concepts (vs entities) — fixes the policy category. */
  isConcept: boolean;
  aiProvider: any;
  model: any;
  /**
   * Shared mutable counter — incremented once per LLM call that fails after all
   * retries (an undecided block). Read by the orchestrator to gate
   * resolution-complete.
   */
  resolutionFailures: { count: number };
}

/**
 * Decide one block and emit Resolution edges.
 *
 * - Block size ≤ smallBlockMaxForPartition → ONE N-way partition LLM call.
 * - Larger blocks → anchor/leader batching: a chosen leader is compared against
 *   the rest in batches, IDENTITY matches are peeled into its cluster, and the
 *   remainder is re-anchored. A per-block linear call budget caps the
 *   degenerate all-distinct case (and logs when it truncates — no silent caps).
 *
 * Existing×existing pairs are never emitted: every edge involves ≥1 new node.
 * Cross-cluster bridges therefore happen only through a new node and are closed
 * for free later by confirmedEdgeClustering.
 */
export async function resolveBlock(block: Block, ctx: ResolveBlockContext): Promise<Resolution[]> {
  const nodes = block
    .map((id) => ctx.nodeById.get(id))
    .filter((n): n is Entity | Concept => n !== undefined);

  // A singleton (or sub-singleton) block has no duplicates → no LLM call.
  if (nodes.length <= 1) {
    return [];
  }

  // Every emitted edge requires a new endpoint (see pushEdge), so a block with
  // no new node can only produce discarded edges — skip the LLM call entirely.
  if (!nodes.some((n) => ctx.newNodeIds.has(n.id))) {
    return [];
  }

  const category = ctx.isConcept ? 'CONCEPT' : 'ENTITY';
  const allowedEdgeTypes = getEnabledEdgeTypes(category, category);
  if (allowedEdgeTypes.length === 0) {
    logger.debug('[RESOLUTION-V2] No policy for block category, skipping', { category });
    return [];
  }
  const worldKnowledgeAllowed = getWorldKnowledgePolicy(category, category);
  const promptOpts = { allowedEdgeTypes, worldKnowledgeAllowed };

  const { smallBlockMaxForPartition } = signalsConfig.blocking;

  return nodes.length <= smallBlockMaxForPartition
    ? resolvePartition(nodes, ctx, promptOpts)
    : resolveByAnchoring(nodes, ctx, promptOpts);
}

interface PromptOpts {
  allowedEdgeTypes: ResolutionEdgeName[];
  worldKnowledgeAllowed: boolean;
}

async function resolvePartition(
  nodes: Array<Entity | Concept>,
  ctx: ResolveBlockContext,
  opts: PromptOpts
): Promise<Resolution[]> {
  const prompt = buildPartitionPrompt(nodes, opts);
  const parsed = await callCluster(prompt, ctx);
  if (!parsed) {
    return [];
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const resolutions: Resolution[] = [];

  // IDENTITY groups → a star centered on a NEW member (every edge new-involving).
  for (const group of parsed.groups) {
    const members = group.members.map((id) => byId.get(id)).filter((n): n is Entity | Concept => !!n);
    if (members.length < 2) {
      continue;
    }
    const newMembers = members.filter((m) => ctx.newNodeIds.has(m.id));
    if (newMembers.length === 0) {
      continue; // all-existing group → never re-judged
    }
    const rep = highestMentionCount(newMembers);
    for (const m of members) {
      if (m.id === rep.id) {
        continue;
      }
      pushEdge(resolutions, rep, m, 'IDENTITY', group.confidence, group.rationale, ctx, 'resolution_v2_partition');
    }
  }

  // Optional non-identity relations between distinct nodes.
  for (const rel of parsed.relations) {
    const from = byId.get(rel.from);
    const to = byId.get(rel.to);
    if (from && to && from.id !== to.id) {
      pushEdge(resolutions, from, to, rel.type, rel.confidence, rel.rationale, ctx, 'resolution_v2_partition');
    }
  }

  return resolutions;
}

async function resolveByAnchoring(
  nodes: Array<Entity | Concept>,
  ctx: ResolveBlockContext,
  opts: PromptOpts
): Promise<Resolution[]> {
  const { anchorBatchSize } = signalsConfig.blocking;
  const resolutions: Resolution[] = [];

  let remaining = [...nodes];
  let callsMade = 0;
  // Linear per-block call budget: a true single cluster resolves in one pass of
  // ⌈n/batch⌉ calls; this caps the degenerate all-distinct case to the same order.
  const callBudget = 2 * Math.ceil(nodes.length / anchorBatchSize) + 4;

  while (remaining.length > 1 && callsMade < callBudget) {
    const anchor = pickAnchor(remaining, ctx);
    const rest = remaining.filter((n) => n.id !== anchor.id);
    const matchedIds = new Set<string>();

    for (let i = 0; i < rest.length && callsMade < callBudget; i += anchorBatchSize) {
      const batch = rest.slice(i, i + anchorBatchSize);
      const prompt = buildAnchorBatchPrompt(anchor, batch, opts);
      const parsed = await callCluster(prompt, ctx);
      callsMade++;
      if (!parsed) {
        continue;
      }
      for (const match of parsed.matches) {
        const cand = batch.find((b) => b.id === match.id);
        if (!cand) {
          continue;
        }
        pushEdge(resolutions, anchor, cand, match.type, match.confidence, match.rationale, ctx, 'resolution_v2_anchor');
        if (match.type === 'IDENTITY') {
          matchedIds.add(cand.id);
        }
      }
    }

    // Remove the anchor and its IDENTITY matches; the rest is re-anchored.
    remaining = remaining.filter((n) => n.id !== anchor.id && !matchedIds.has(n.id));
  }

  if (remaining.length > 1 && callsMade >= callBudget) {
    logger.warn('[RESOLUTION-V2] Anchor loop hit call budget; remaining nodes left unresolved', {
      blockSize: nodes.length,
      unresolved: remaining.length,
      callBudget,
    });
  }

  return resolutions;
}

/**
 * Run one cluster LLM call with retry; returns null on call/parse failure.
 *
 * A failure here means the block is UNDECIDED (retries already exhausted), not
 * "no matches" — so it bumps the shared failure counter the orchestrator uses to
 * refuse marking documents resolution-complete.
 */
async function callCluster(prompt: string, ctx: ResolveBlockContext) {
  try {
    const response = await retryWithBackoff<{ text: string }>(() =>
      ctx.aiProvider.completion(prompt, {
        model: ctx.model.externalId,
        temperature: 0.1,
        topP: 0.5,
      })
    );
    return parseClusterResponse(response.text);
  } catch (error) {
    logger.error('[RESOLUTION-V2] Cluster LLM call failed', { error });
    ctx.resolutionFailures.count += 1;
    return null;
  }
}

/**
 * Choose a block leader: prefer an existing frozen-cluster member (so new nodes
 * attach to the known cluster), else the highest-mentionCount node. Deterministic.
 */
function pickAnchor(nodes: Array<Entity | Concept>, ctx: ResolveBlockContext): Entity | Concept {
  const frozen = nodes.filter((n) => ctx.frozenClusterByMember.has(n.id));
  if (frozen.length > 0) {
    return [...frozen].sort((a, b) => a.id.localeCompare(b.id))[0];
  }
  return highestMentionCount(nodes);
}

function highestMentionCount(nodes: Array<Entity | Concept>): Entity | Concept {
  return [...nodes].sort((a, b) => {
    const diff = (b.mentionCount ?? 0) - (a.mentionCount ?? 0);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  })[0];
}

/**
 * Build and push a Resolution for a pair, after enforcing: (1) at least one
 * endpoint is new, and (2) the edge type is allowed by policy.
 */
function pushEdge(
  out: Resolution[],
  n1: Entity | Concept,
  n2: Entity | Concept,
  edgeType: ResolutionEdgeName,
  confidence: number,
  rationale: string,
  ctx: ResolveBlockContext,
  policy: string
): void {
  if (!ctx.newNodeIds.has(n1.id) && !ctx.newNodeIds.has(n2.id)) {
    return; // existing×existing is never (re-)judged
  }
  const category = ctx.isConcept ? 'CONCEPT' : 'ENTITY';
  if (!validateEdgeTypeAllowed(edgeType, category, category)) {
    return;
  }

  const cosineSimScore = ctx.graph.get(n1.id)?.get(n2.id) ?? ctx.graph.get(n2.id)?.get(n1.id) ?? 0;
  const sharedAliases = ctx.isConcept ? [] : getSharedNames(n1 as Entity, n2 as Entity);

  out.push({
    entity1: n1,
    entity2: n2,
    edgeType,
    confidence,
    rationale,
    decidedBy: 'llm',
    signals: {
      cosineSimScore,
      sharedAliases,
      sharedDoc: n1.documentId === n2.documentId,
    },
    policy,
    policyVersion: resolutionPolicy.policyVersion,
    resolvedAt: new Date(),
  });
}
