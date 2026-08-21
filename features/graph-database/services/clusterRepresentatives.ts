import type { Entity, Concept } from '@/features/graph-database/types';

/**
 * Representative collapse — pure module.
 *
 * Groups surfaced resolution candidates by their `:IdentityCluster` hub and
 * picks one representative per hub, so downstream blocking/decision compares
 * a new node against ~1 stand-in per cluster instead of every member. This is
 * what stops `removeHubs` from pruning a recurring entity's degree-N star
 * (see .agents/plans/entity-resolution-identity-cluster-hubs.md) and shrinks
 * prompts to the new node plus one enriched representative.
 *
 * A representative's own id/name/type-or-category/documentId/mentionCount/
 * firstSeenAt are preserved exactly — only description and (entities only)
 * aliases are enriched from the group. Never synthesises an id: the chosen
 * representative is always a real surfaced node.
 */

export interface SurfacedCandidate {
  node: Entity | Concept;
  similarity: number;
}

export interface SelectClusterRepresentativesParams {
  surfaced: SurfacedCandidate[];
  /** member id -> hub id. */
  hubByMember: Map<string, string>;
  newNodeIds: Set<string>;
  isConcept: boolean;
}

export interface SelectClusterRepresentativesResult {
  /** member id -> the representative id standing in for its cluster. */
  representativeByMember: Map<string, string>;
  /** representative id -> the enriched node object built for that cluster. */
  representativeNodeById: Map<string, Entity | Concept>;
  stats: { clustersCollapsed: number; candidatesCollapsed: number };
}

export function selectClusterRepresentatives(
  params: SelectClusterRepresentativesParams
): SelectClusterRepresentativesResult {
  const { surfaced, hubByMember, newNodeIds, isConcept } = params;

  // Group surfaced candidates by hub. New nodes are excluded from the pool:
  // they have no hub yet, and even a re-resolution of already-resolved
  // documents (which can place a new-batch node inside an existing hub) must
  // not let the node being judged this pass stand in as its own cluster rep.
  const byHub = new Map<string, SurfacedCandidate[]>();
  for (const item of surfaced) {
    if (newNodeIds.has(item.node.id)) {
      continue;
    }
    const hubId = hubByMember.get(item.node.id);
    if (!hubId) {
      continue;
    }
    const group = byHub.get(hubId);
    if (group) {
      group.push(item);
    } else {
      byHub.set(hubId, [item]);
    }
  }

  const representativeByMember = new Map<string, string>();
  const representativeNodeById = new Map<string, Entity | Concept>();
  let clustersCollapsed = 0;
  let candidatesCollapsed = 0;

  for (const group of byHub.values()) {
    // The same member can be surfaced more than once (different sources, or
    // different similarity scores) — dedupe to its best-observed similarity.
    const byMemberId = new Map<string, SurfacedCandidate>();
    for (const item of group) {
      const existing = byMemberId.get(item.node.id);
      if (!existing || item.similarity > existing.similarity) {
        byMemberId.set(item.node.id, item);
      }
    }

    const members = [...byMemberId.values()];
    if (members.length < 2) {
      continue; // a single surfaced member isn't a collapse
    }

    const representative = pickRepresentative(members);
    const representativeNode = buildEnrichedRepresentative(representative.node, members, isConcept);

    representativeNodeById.set(representative.node.id, representativeNode);
    for (const { node } of members) {
      representativeByMember.set(node.id, representative.node.id);
    }

    clustersCollapsed++;
    candidatesCollapsed += members.length;
  }

  return {
    representativeByMember,
    representativeNodeById,
    stats: { clustersCollapsed, candidatesCollapsed },
  };
}

/** Highest similarity wins; ties broken by lowest id (deterministic). */
function pickRepresentative(members: SurfacedCandidate[]): SurfacedCandidate {
  return [...members].sort((a, b) => {
    const diff = b.similarity - a.similarity;
    return diff !== 0 ? diff : a.node.id.localeCompare(b.node.id);
  })[0];
}

/**
 * Build the enriched stand-in for a cluster: the representative's own
 * identity fields untouched, description widened to the longest non-empty
 * one in the group, and (entities only) aliases widened to the deduplicated
 * union of every member's aliases + name, excluding the representative's own
 * name. Never mutates `representative` or any member's arrays.
 */
function buildEnrichedRepresentative(
  representative: Entity | Concept,
  members: SurfacedCandidate[],
  isConcept: boolean
): Entity | Concept {
  const longestDescription = [...members]
    .filter((m) => !!m.node.description && m.node.description.length > 0)
    .sort((a, b) => {
      const diff = b.node.description.length - a.node.description.length;
      return diff !== 0 ? diff : a.node.id.localeCompare(b.node.id);
    })[0]?.node.description;

  const base: Entity | Concept = {
    ...representative,
    description: longestDescription ?? representative.description,
  };

  if (isConcept) {
    return base;
  }

  const repEntity = representative as Entity;
  const normalizedOwnName = repEntity.name.toLowerCase().trim();
  const seenNormalized = new Set<string>([normalizedOwnName]);
  const aliases: string[] = [];

  for (const { node } of members) {
    const entity = node as Entity;
    for (const alias of [...(entity.aliases ?? []), entity.name]) {
      const normalized = alias.toLowerCase().trim();
      if (!normalized || seenNormalized.has(normalized)) {
        continue;
      }
      seenNormalized.add(normalized);
      aliases.push(alias);
    }
  }

  return {
    ...base,
    aliases: aliases.sort((a, b) => a.localeCompare(b)),
  } as Entity;
}
