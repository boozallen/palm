import logger from '@/server/logger';
import db from '@/server/db';
import { PrimitiveConfig } from '@/features/workflows/types/primitive';
import resolveArtifactPrimitiveCosts from '@/features/workflows/utils/resolveArtifactPrimitiveCosts';

export type WorkflowArtifactCost = {
  artifactId: string;
  label: string;
  fileExtension: string;
  workflowExecutionId: string;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

/**
 * Per-artifact cost for a set of workflow executions.
 *
 * Cost is attributed per primitive: each artifact is charged for the PROMPT
 * primitives upstream of it in the workflow DAG (see
 * resolveArtifactPrimitiveCosts). Artifacts with no upstream prompt spend — a
 * workflow that only scrapes and formats, or an execution predating usage
 * attribution — return null rather than 0, so the UI can distinguish "free"
 * from "unknown".
 *
 * `cumulativeCost`/`cumulativeTokens` report the undivided spend of everything
 * upstream of the artifact — the total work the execution had to do to reach it,
 * which for a single-artifact workflow is the whole execution's spend. This
 * includes embedding the retrieval queries upstream prompts issued, which `cost`
 * excludes: reaching the artifact required those lookups, but they are not part
 * of the per-primitive figure already on screen.
 */
export default async function getWorkflowArtifactCosts(
  workflowExecutionIds: string[],
  userGroupId?: string,
): Promise<Map<string, WorkflowArtifactCost>> {
  const result = new Map<string, WorkflowArtifactCost>();
  if (workflowExecutionIds.length === 0) {
    return result;
  }

  // Execution ids are admitted into the list by the triggering user's current
  // group membership elsewhere in the caller, which is not the same thing as
  // which group a usage row was tagged with when it ran. A specific group must
  // only count spend actually tagged with it; no group only has to drop untagged spend.
  const usageGroupFilter = userGroupId && userGroupId !== 'all'
    ? userGroupId
    : { not: null };

  try {
    const [executions, artifacts, usageRecords] = await Promise.all([
      db.workflowExecution.findMany({
        where: { id: { in: workflowExecutionIds } },
        select: { id: true, workflow: { select: { definition: true } } },
      }),
      db.workflowArtifact.findMany({
        where: { workflowExecutionId: { in: workflowExecutionIds } },
        select: {
          id: true,
          label: true,
          fileExtension: true,
          workflowExecutionId: true,
          primitiveId: true,
        },
      }),
      db.aiProviderUsage.findMany({
        // A prompt primitive's query embedding shares this exact
        // (execution, primitive) key, so the two kinds are split apart below
        // rather than filtered out here — embedding spend feeds only the
        // cumulative figure, and one query with an explicit partition cannot
        // drift the way two queries over the same execution ids can.
        where: { workflowExecutionId: { in: workflowExecutionIds }, userGroupId: usageGroupFilter },
        select: {
          workflowExecutionId: true,
          primitiveId: true,
          embedding: true,
          inputTokensUsed: true,
          costPerInputToken: true,
          outputTokensUsed: true,
          costPerOutputToken: true,
        },
      }),
    ]);

    // Sum usage per (execution, primitive) — a prompt primitive may issue
    // several LLM calls, and may embed several retrieval queries. The two are
    // accumulated into separate maps so a primitive with only embedding rows
    // stays absent from the LLM map and its artifact's own cost reads as unknown
    // rather than as zero.
    type PerPrimitiveUsage = Map<string, { cost: number; tokens: number }>;
    const usageByExecution = new Map<string, PerPrimitiveUsage>();
    const embeddingByExecution = new Map<string, PerPrimitiveUsage>();
    for (const r of usageRecords) {
      if (!r.workflowExecutionId || !r.primitiveId) { continue; }
      const target = r.embedding ? embeddingByExecution : usageByExecution;
      const perPrimitive = target.get(r.workflowExecutionId) ?? new Map();
      const existing = perPrimitive.get(r.primitiveId) ?? { cost: 0, tokens: 0 };
      existing.cost += r.inputTokensUsed * r.costPerInputToken + r.outputTokensUsed * r.costPerOutputToken;
      existing.tokens += r.inputTokensUsed + r.outputTokensUsed;
      perPrimitive.set(r.primitiveId, existing);
      target.set(r.workflowExecutionId, perPrimitive);
    }

    const toPrimitiveUsage = (perPrimitive: PerPrimitiveUsage | undefined) =>
      Array.from(perPrimitive?.entries() ?? []).map(([primitiveId, u]) => ({
        primitiveId,
        cost: u.cost,
        tokens: u.tokens,
      }));

    const artifactsByExecution = new Map<string, typeof artifacts>();
    for (const art of artifacts) {
      const list = artifactsByExecution.get(art.workflowExecutionId) ?? [];
      list.push(art);
      artifactsByExecution.set(art.workflowExecutionId, list);
    }

    for (const execution of executions) {
      const executionArtifacts = artifactsByExecution.get(execution.id) ?? [];
      if (executionArtifacts.length === 0) { continue; }

      const definition = execution.workflow?.definition as { primitives?: PrimitiveConfig[] } | null;
      const primitives = definition?.primitives ?? [];
      const costsByArtifactPrimitive = resolveArtifactPrimitiveCosts(
        primitives,
        toPrimitiveUsage(usageByExecution.get(execution.id)),
        toPrimitiveUsage(embeddingByExecution.get(execution.id)),
      );

      for (const art of executionArtifacts) {
        const resolved = costsByArtifactPrimitive.get(art.primitiveId);
        const hasSpend = resolved !== undefined && resolved.contributingPrimitiveIds.length > 0;
        const hasCumulativeSpend = resolved !== undefined
          && resolved.cumulativeContributingPrimitiveIds.length > 0;
        result.set(art.id, {
          artifactId: art.id,
          label: art.label,
          fileExtension: art.fileExtension,
          workflowExecutionId: art.workflowExecutionId,
          cost: hasSpend ? resolved.cost : null,
          tokens: hasSpend ? resolved.tokens : null,
          cumulativeCost: hasCumulativeSpend ? resolved.cumulativeCost : null,
          cumulativeTokens: hasCumulativeSpend ? resolved.cumulativeTokens : null,
        });
      }
    }

    return result;
  } catch (error) {
    logger.error('Failed to fetch workflow artifact costs', error);
    throw new Error('Unable to fetch workflow artifact costs');
  }
}
