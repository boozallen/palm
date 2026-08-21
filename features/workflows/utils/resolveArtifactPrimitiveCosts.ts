import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';

export type PrimitiveUsage = {
  primitiveId: string;
  cost: number;
  tokens: number;
};

export type ArtifactCost = {
  cost: number;
  tokens: number;
  // Undivided upstream spend: everything this artifact's prompt ancestors
  // consumed, without the fan-out split that `cost` applies. Answers "what did
  // it take to get here" rather than "what is this artifact's share".
  cumulativeCost: number;
  cumulativeTokens: number;
  // Prompt primitives whose LLM spend was attributed to this artifact.
  contributingPrimitiveIds: string[];
  // Prompt primitives that contributed to the cumulative figure — a superset,
  // since a prompt may have query-embedding spend recorded but no LLM row. Kept
  // separate so an artifact with retrieval spend but no LLM spend reports a
  // cumulative total while its own cost still reads as unknown.
  cumulativeContributingPrimitiveIds: string[];
};

/**
 * Resolve per-artifact cost for a workflow execution.
 *
 * An ARTIFACT primitive never calls an LLM — it formats data handed to it by
 * upstream primitives — so its own `primitiveId` carries no usage rows. The cost
 * of an artifact is therefore the cost of the PROMPT primitives that fed it,
 * found by walking `predecessorIds` upstream from the artifact primitive.
 *
 * Two figures come back per artifact:
 *
 * - `cost` splits a prompt primitive's spend evenly across every artifact it
 *   feeds, so the per-artifact costs across an execution sum to what the
 *   execution actually cost. This is the attribution figure.
 * - `cumulativeCost` charges the artifact for the full spend of every prompt
 *   upstream of it, unsplit. Across a fan-out these overlap and deliberately
 *   sum to more than the execution cost — the number reports the work required
 *   to reach the artifact, which is what a reader comparing outputs wants.
 *
 * `embeddingByPrimitive` is the spend on embedding a prompt primitive's retrieval
 * query. It is passed apart from `usageByPrimitive` rather than summed into it
 * because it counts toward the cumulative figure only: `cost` is already on
 * screen as $ Artifact and must not move as embedding attribution lands.
 */
export default function resolveArtifactPrimitiveCosts(
  primitives: PrimitiveConfig[],
  usageByPrimitive: PrimitiveUsage[],
  embeddingByPrimitive: PrimitiveUsage[] = [],
): Map<string, ArtifactCost> {
  const byId = new Map(primitives.map((p) => [p.id, p]));
  const usageMap = new Map(usageByPrimitive.map((u) => [u.primitiveId, u]));
  const embeddingMap = new Map(embeddingByPrimitive.map((u) => [u.primitiveId, u]));

  const artifactPrimitiveIds = primitives
    .filter((p) => p.type === PrimitiveType.ARTIFACT)
    .map((p) => p.id);

  // Walk upstream from an artifact primitive collecting PROMPT ancestors.
  // `seen` guards against cycles in a malformed definition.
  const promptAncestors = (artifactId: string): string[] => {
    const found = new Set<string>();
    const seen = new Set<string>();
    const queue = [...(byId.get(artifactId)?.predecessorIds ?? [])];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) { continue; }
      seen.add(id);

      const primitive = byId.get(id);
      if (!primitive) { continue; }

      if (primitive.type === PrimitiveType.PROMPT) {
        found.add(id);
      }

      // Keep ascending past every node type: a prompt may sit behind a
      // document or webscraper primitive.
      queue.push(...(primitive.predecessorIds ?? []));
    }

    return Array.from(found);
  };

  const ancestorsByArtifact = new Map<string, string[]>();
  for (const artifactId of artifactPrimitiveIds) {
    ancestorsByArtifact.set(artifactId, promptAncestors(artifactId));
  }

  // How many artifacts each prompt primitive feeds, for even splitting.
  const consumerCount = new Map<string, number>();
  for (const ancestors of ancestorsByArtifact.values()) {
    for (const promptId of ancestors) {
      consumerCount.set(promptId, (consumerCount.get(promptId) ?? 0) + 1);
    }
  }

  const result = new Map<string, ArtifactCost>();
  for (const [artifactId, ancestors] of ancestorsByArtifact.entries()) {
    let cost = 0;
    let tokens = 0;
    let cumulativeCost = 0;
    let cumulativeTokens = 0;
    const contributingPrimitiveIds: string[] = [];
    const cumulativeContributingPrimitiveIds: string[] = [];

    for (const promptId of ancestors) {
      const usage = usageMap.get(promptId);
      if (usage) {
        const share = consumerCount.get(promptId) ?? 1;
        cost += usage.cost / share;
        tokens += usage.tokens / share;
        cumulativeCost += usage.cost;
        cumulativeTokens += usage.tokens;
        contributingPrimitiveIds.push(promptId);
      }

      // Never divided by `share`: the retrieval ran once, but no artifact
      // downstream of it could exist without it.
      const embedding = embeddingMap.get(promptId);
      if (embedding) {
        cumulativeCost += embedding.cost;
        cumulativeTokens += embedding.tokens;
      }

      if (usage || embedding) {
        cumulativeContributingPrimitiveIds.push(promptId);
      }
    }

    result.set(artifactId, {
      cost,
      tokens: Math.round(tokens),
      cumulativeCost,
      cumulativeTokens: Math.round(cumulativeTokens),
      contributingPrimitiveIds,
      cumulativeContributingPrimitiveIds,
    });
  }

  return result;
}
