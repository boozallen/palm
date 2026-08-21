import type { AiRepository } from '@/features/ai-provider/sources/types';
import { MessageRole } from '@/features/chat/types/message';
import { logger } from '@/server/logger';

/**
 * Enumeration intent — the user is asking for a complete list. These questions
 * MUST pass through untouched: pruning a "list every X" is the exact incompleteness
 * the truncation fix removed.
 */
const ENUMERATION_INTENT =
  /\b(list|every|all|each|enumerate|how many|count|what (entities|concepts|people|relationships|nodes|types|documents))\b/i;

const FILTER_PROMPT = (question: string, rowsList: string): string =>
  `Given the user question below, identify result rows that are IRRELEVANT to answering it. Keep everything that could be useful — only remove rows that are clearly off-topic or unrelated to the question.

Return JSON only, no other text:
{ "irrelevant": [{ "index": 3, "reason": "brief reason" }, { "index": 7, "reason": "brief reason" }] }

If ALL rows are relevant, return: { "irrelevant": [] }

The index numbers are zero-based indices into the list below.

Question: ${question}

Rows:
${rowsList}`;

/** Render a row's human-readable values for the relevance judge (skip the
 *  internal `_nodeId_*` graph-linking columns). */
function rowToText(row: Record<string, unknown>, index: number): string {
  const parts = Object.entries(row)
    .filter(([k]) => !k.startsWith('_nodeId'))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  return `${index}. ${parts.join(' | ')}`;
}

/**
 * Question-aware relevance filter for cypher result rows (A5).
 *
 * - Enumeration intent ("list all/every", counts) → strict pass-through, no LLM
 *   call, zero row loss.
 * - Selective intent → a single LLM judge identifies IRRELEVANT rows (with reasons,
 *   mirroring filterAnchorsForRelevance), and they are pruned. Never reduces a
 *   non-empty set to zero, and falls back to the full set on any error.
 *
 * Wired in AFTER the tenancy filter, so it never scores inaccessible rows. Prunes
 * only; it does not reorder rows or add a score column (the cypher's own ORDER BY
 * and the table columns are preserved).
 */
export async function filterCypherRowsForRelevance({
  subQuestion,
  rows,
  source,
  model,
}: {
  subQuestion: string;
  rows: Record<string, unknown>[];
  source: AiRepository;
  model: { externalId: string };
}): Promise<{ rows: Record<string, unknown>[] }> {
  // Nothing to prune, or an explicit enumeration → faithful pass-through.
  if (rows.length <= 1 || ENUMERATION_INTENT.test(subQuestion)) {
    return { rows };
  }

  try {
    const rowsList = rows.map((row, i) => rowToText(row, i)).join('\n');

    const response = await source.chatCompletion(
      [{ role: MessageRole.User, content: FILTER_PROMPT(subQuestion, rowsList) }],
      { model: model.externalId, temperature: 0, topP: 0 },
    );

    let cleaned = response.text
      .replace(/```(?:json)?\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[CYPHER-RELEVANCE] no JSON found, keeping all rows', { raw: response.text.substring(0, 200) });
      return { rows };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const irrelevantItems = Array.isArray(parsed?.irrelevant) ? parsed.irrelevant : [];
    const irrelevantIndices = new Set<number>(
      irrelevantItems
        .filter((item: unknown) => {
          const idx = (item as { index?: unknown })?.index;
          return typeof idx === 'number' && idx >= 0 && idx < rows.length;
        })
        .map((item: { index: number }) => item.index),
    );

    if (irrelevantIndices.size > 0) {
      logger.info('[CYPHER-RELEVANCE] pruned rows', {
        subQuestion: subQuestion.substring(0, 80),
        droppedCount: irrelevantIndices.size,
        keptCount: rows.length - irrelevantIndices.size,
      });
    }

    const kept = rows.filter((_, i) => !irrelevantIndices.has(i));
    // Never reduce a non-empty set to zero.
    return { rows: kept.length > 0 ? kept : rows };
  } catch (error) {
    logger.warn('[CYPHER-RELEVANCE] filter failed, keeping all rows', { error });
    return { rows };
  }
}
