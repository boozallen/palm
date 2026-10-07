import type { Entity, Concept } from '@/features/graph-database/types';
import type { ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';
import {
  formatNodeContext,
  getEdgeTypeDefinitions,
  getWorldKnowledgeInstructions,
} from '@/features/graph-database/services/resolutionPrompt';

/**
 * Cluster-decision prompts for V2 resolution. Mirrors resolutionPrompt.ts
 * conventions (node-context formatting, edge-type definitions, strict-JSON
 * output) but asks ONE question per BLOCK instead of per pair:
 *  - buildPartitionPrompt  → "partition these N nodes into same-entity groups"
 *  - buildAnchorBatchPrompt → "which candidates are the same entity as the anchor"
 */

const VALID_EDGE_TYPES: ResolutionEdgeName[] = ['IDENTITY', 'SIMILAR', 'RELATED_RESOLUTION'];

export interface ClusterPromptOptions {
  allowedEdgeTypes: ResolutionEdgeName[];
  worldKnowledgeAllowed: boolean;
}

/** One same-entity group from a partition decision (IDENTITY members). */
export interface PartitionGroup {
  members: string[];
  confidence: number;
  rationale: string;
}

/** A non-identity relationship between two nodes (SIMILAR / RELATED_RESOLUTION). */
export interface ClusterRelation {
  from: string;
  to: string;
  type: ResolutionEdgeName;
  confidence: number;
  rationale: string;
}

/** One anchor-batch verdict: how a candidate relates to the anchor. */
export interface AnchorMatch {
  id: string;
  type: ResolutionEdgeName;
  confidence: number;
  rationale: string;
}

export interface ClusterResponse {
  groups: PartitionGroup[];
  relations: ClusterRelation[];
  matches: AnchorMatch[];
}

function isConceptNode(node: Entity | Concept): node is Concept {
  return 'category' in node && !('type' in node);
}

/** Node context labeled with its stable id so the LLM can reference it. */
function formatNodeWithId(node: Entity | Concept): string {
  return `[id: ${node.id}]\n${formatNodeContext(node)}`;
}

/**
 * Build an N-way partition prompt for a small block. The LLM groups nodes that
 * are the SAME real-world entity (IDENTITY) and may report non-identity
 * relationships between distinct nodes using the allowed edge types.
 */
export function buildPartitionPrompt(
  nodes: Array<Entity | Concept>,
  options: ClusterPromptOptions
): string {
  const { allowedEdgeTypes, worldKnowledgeAllowed } = options;
  const bothConcepts = nodes.every(isConceptNode);
  const bothEntities = nodes.every((n) => !isConceptNode(n));

  const nodeList = nodes.map(formatNodeWithId).join('\n\n');
  const edgeTypeDefinitions = getEdgeTypeDefinitions(allowedEdgeTypes, bothConcepts, bothEntities);
  const worldKnowledgeInstr = getWorldKnowledgeInstructions(worldKnowledgeAllowed);
  const nonIdentityTypes = allowedEdgeTypes.filter((t) => t !== 'IDENTITY');

  return `You are resolving which of the following ${nodes.length} nodes refer to the SAME real-world ${bothConcepts ? 'concept' : 'entity'}.

NODES:
${nodeList}

EDGE TYPE DEFINITIONS:
${edgeTypeDefinitions}
- UNRELATED: No meaningful relationship

${worldKnowledgeInstr}

**Task:**
1. Partition the node ids into groups where every member of a group is the SAME (IDENTITY). A node that matches no other is its own singleton group.
${nonIdentityTypes.length > 0 ? `2. Optionally report relationships between distinct nodes using ONLY: ${nonIdentityTypes.join(', ')}.` : ''}

**Return ONLY valid JSON:**
{
  "groups": [
    { "members": ["<id>", "<id>"], "confidence": 0.0-1.0, "rationale": "why these are the same" }
  ]${nonIdentityTypes.length > 0 ? `,
  "relations": [
    { "from": "<id>", "to": "<id>", "type": "${nonIdentityTypes.join('" | "')}", "confidence": 0.0-1.0, "rationale": "..." }
  ]` : ''}
}

**Important:**
- EVERY node id must appear in exactly one group (singletons included)
- Only group nodes you are confident are the SAME entity
- Return ONLY valid JSON, no extra text`;
}

/**
 * Build an anchor/leader prompt for a large block. The LLM decides which of the
 * batch candidates are the same entity as (or otherwise related to) the anchor.
 */
export function buildAnchorBatchPrompt(
  anchor: Entity | Concept,
  candidates: Array<Entity | Concept>,
  options: ClusterPromptOptions
): string {
  const { allowedEdgeTypes, worldKnowledgeAllowed } = options;
  const isConcept = isConceptNode(anchor);
  const candidateList = candidates.map(formatNodeWithId).join('\n\n');
  const edgeTypeDefinitions = getEdgeTypeDefinitions(allowedEdgeTypes, isConcept, !isConcept);
  const worldKnowledgeInstr = getWorldKnowledgeInstructions(worldKnowledgeAllowed);

  return `You are resolving which of the candidate nodes refer to the SAME real-world ${isConcept ? 'concept' : 'entity'} as the ANCHOR.

ANCHOR:
${formatNodeWithId(anchor)}

CANDIDATES:
${candidateList}

EDGE TYPE DEFINITIONS:
${edgeTypeDefinitions}
- UNRELATED: No meaningful relationship

${worldKnowledgeInstr}

**Task:**
For each candidate, decide its relationship to the ANCHOR using ONLY: ${allowedEdgeTypes.join(', ')}, or UNRELATED.

**Return ONLY valid JSON:**
{
  "matches": [
    { "id": "<candidate id>", "type": "${allowedEdgeTypes.join('" | "')}", "confidence": 0.0-1.0, "rationale": "..." }
  ]
}

**Important:**
- Only include candidates that are IDENTITY/${allowedEdgeTypes.filter((t) => t !== 'IDENTITY').join('/') || 'related'}; OMIT candidates that are UNRELATED
- Return ONLY valid JSON, no extra text`;
}

/**
 * Parse a cluster LLM response. Permissive across both prompt shapes: returns
 * whichever of `groups` / `relations` / `matches` are present (others empty),
 * keeping only structurally valid, in-range entries. Throws only when no JSON
 * object can be found at all.
 */
export function parseClusterResponse(response: string): ClusterResponse {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in cluster response\nResponse: ${response}`);
  }

  let json: any;
  try {
    json = JSON.parse(jsonMatch[0]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse cluster response: ${msg}\nResponse: ${response}`);
  }

  const inRange = (c: unknown): c is number => typeof c === 'number' && c >= 0 && c <= 1;
  const validType = (t: unknown): t is ResolutionEdgeName =>
    typeof t === 'string' && VALID_EDGE_TYPES.includes(t as ResolutionEdgeName);

  const groups: PartitionGroup[] = Array.isArray(json.groups)
    ? json.groups
        .filter((g: any) => Array.isArray(g?.members) && g.members.length > 0)
        .map((g: any) => ({
          members: g.members.filter((m: unknown) => typeof m === 'string'),
          confidence: inRange(g.confidence) ? g.confidence : 0.5,
          rationale: typeof g.rationale === 'string' ? g.rationale : '',
        }))
        .filter((g: PartitionGroup) => g.members.length > 0)
    : [];

  const relations: ClusterRelation[] = Array.isArray(json.relations)
    ? json.relations
        .filter(
          (r: any) =>
            typeof r?.from === 'string' && typeof r?.to === 'string' && validType(r?.type)
        )
        .map((r: any) => ({
          from: r.from,
          to: r.to,
          type: r.type as ResolutionEdgeName,
          confidence: inRange(r.confidence) ? r.confidence : 0.5,
          rationale: typeof r.rationale === 'string' ? r.rationale : '',
        }))
    : [];

  const matches: AnchorMatch[] = Array.isArray(json.matches)
    ? json.matches
        .filter((m: any) => typeof m?.id === 'string' && validType(m?.type))
        .map((m: any) => ({
          id: m.id,
          type: m.type as ResolutionEdgeName,
          confidence: inRange(m.confidence) ? m.confidence : 0.5,
          rationale: typeof m.rationale === 'string' ? m.rationale : '',
        }))
    : [];

  return { groups, relations, matches };
}
