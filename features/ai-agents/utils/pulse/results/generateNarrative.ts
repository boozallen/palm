import { z } from 'zod';

import logger from '@/server/logger';
import {
  PULSE_NARRATIVE_SYSTEM_PROMPT,
  PULSE_NARRATIVE_TASK,
} from '@/features/ai-agents/data/pulse/prompts';
import type { Message } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { MAX_RESULTS_FOCUS_LENGTH } from '@/features/ai-agents/utils/pulse/fieldSchema';
import { MIN_GROUP_ANSWERS } from '@/features/ai-agents/utils/pulse/results/buildBreakdowns';
import { formatShare } from '@/features/ai-agents/utils/pulse/results/charts';
import { normalizeAnswer } from '@/features/ai-agents/utils/pulse/results/parseAnswers';
import { DISTRIBUTION_DATA_NOTICE, fenceData } from '@/features/ai-agents/utils/pulse/worker/dataFence';
import { parseJsonObject } from '@/features/ai-agents/utils/shared/parseJsonObject';
import type { PulseCompletionAdapter } from '@/features/ai-agents/utils/pulse/worker/extractRow';
import {
  PULSE_FINDING_TONES,
  type PulseBreakdown,
  type PulseColumnProfile,
  type PulseNarrative,
  type PulseQuote,
  type PulseResultsProfile,
  type PulseRunFacts,
  type PulseValueCount,
} from '@/features/ai-agents/types/pulse/results';

export const MAX_NARRATIVE_PROMPT_CHARS = 60_000;
export const COUNTS_KEPT_WHEN_TRIMMED = 5;

const MAX_ATTEMPTS = 2;

export type NarrativeInput = {
  facts: Pick<PulseRunFacts, 'surveyFilename' | 'rowsInFile' | 'rowsAnalyzed' | 'failedRowCount'>;
  profile: PulseResultsProfile;
  resultsFocus: string | null;
};

export type GenerateNarrativeParams = NarrativeInput & {
  persona: string;
  completionAdapter: PulseCompletionAdapter;
};

/**
 * How much of the data one rendering of the prompt carries. `countsPerColumn: null` keeps every
 * count; `maxColumns: null` keeps every column summary.
 */
type PromptLimits = {
  quotes: number;
  countsPerColumn: number | null;
  breakdowns: number;
  maxColumns: number | null;
};

const text = (max: number) => z.string().trim().min(1).max(max);

// These fields only enrich the dashboard, so a bad value falls back instead of failing the reply.
const lenientText = (max: number) => text(max).nullable().catch(null);

const NARRATIVE_SCHEMA = z.object({
  headline: text(400),
  overview: text(4_000),
  keyFindings: z.array(z.object({
    title: text(200),
    detail: text(1_200),
    columns: z.array(z.string()).max(12).default([]),
    quoteIds: z.array(z.string()).max(3).default([]),
    tone: z.enum(PULSE_FINDING_TONES).catch('neutral'),
    whyItMatters: lenientText(600),
    caveat: lenientText(400),
  })).min(3).max(6),
  recommendedActions: z.array(z.object({
    action: text(400),
    rationale: text(600),
    finding: z.number().int().nullable().catch(null),
  })).min(3).max(6),
  columnNotes: z.record(z.string().trim().max(400)).default({}),
  featuredColumns: z.array(z.string()).max(6).default([]),
  quoteIds: z.array(z.string()).max(6).default([]),
});

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function kindSummary(column: PulseColumnProfile): string {
  switch (column.kind) {
    case 'categorical':
      return `categorical, ${column.counts.length} values`;
    case 'numeric':
      return `numeric, min ${formatNumber(column.min)}, max ${formatNumber(column.max)}, mean ${formatNumber(column.mean)}, median ${formatNumber(column.median)}`;
    case 'date':
      return `dates, earliest ${column.min}, latest ${column.max}`;
    case 'freeText':
      return 'free text (see quotes)';
    case 'identifier':
      return `identifier, ${column.distinctCount} distinct values (listed only; do not analyze or quote)`;
    case 'empty':
      return 'no answers';
  }
}

function countEntries(column: PulseColumnProfile): PulseValueCount[] {
  switch (column.kind) {
    case 'categorical':
      return column.counts;
    case 'numeric':
      return column.bins.map((bin) => ({ value: `${formatNumber(bin.from)}–${formatNumber(bin.to)}`, count: bin.count }));
    case 'date':
      return column.months;
    default:
      return [];
  }
}

// The largest `limit` entries by count, kept in their original order.
function largest(entries: PulseValueCount[], limit: number): PulseValueCount[] {
  const kept = new Set(
    entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => b.entry.count - a.entry.count || a.index - b.index)
      .slice(0, limit)
      .map(({ index }) => index),
  );

  return entries.filter((_, index) => kept.has(index));
}

function renderColumn(column: PulseColumnProfile, countsPerColumn: number | null): string {
  const fallbacks = column.fallbackCount > 0
    ? ` · ${column.fallbackCount} fallbacks (the tool could not determine a value; these are not answers)`
    : '';
  const summary = `[${column.label}] ${column.source} column · ${kindSummary(column)} · answered by ${column.answeredCount} of ${column.rowCount} rows${fallbacks}`;
  const entries = countEntries(column);
  const shown = countsPerColumn === null || entries.length <= countsPerColumn
    ? entries
    : largest(entries, countsPerColumn);
  const lines = shown.map((entry) => `  ${entry.value}: ${entry.count} (${formatShare(entry.count, column.answeredCount)})`);

  if (shown.length < entries.length) {
    lines.push(`  …and ${entries.length - shown.length} more values`);
  }

  return [summary, ...lines].join('\n');
}

function renderBreakdown(breakdown: PulseBreakdown): string {
  const overallTotal = breakdown.overall.reduce((sum, count) => sum + count, 0);
  const overall = breakdown.values
    .map((value, index) => `${value} ${formatShare(breakdown.overall[index], overallTotal)}`)
    .join(', ');
  const groups = breakdown.groups.map((group) => {
    const size = group.total < MIN_GROUP_ANSWERS ? `n=${group.total}, too small to compare` : `n=${group.total}`;
    const shares = breakdown.values
      .map((value, index) => `${value} ${formatShare(group.counts[index], group.total)} (${group.counts[index]})`)
      .join(', ');

    return `  ${group.group} (${size}): ${shares}`;
  });

  return [
    `${breakdown.toolLabel} by ${breakdown.groupLabel} (widest gap ${(breakdown.score * 100).toFixed(1)} points)`,
    `  All answers (n=${overallTotal}): ${overall}`,
    ...groups,
  ].join('\n');
}

function renderQuote(quote: PulseQuote): string {
  return `[${quote.id}] row ${quote.rowNumber}, ${quote.columnLabel}: ${JSON.stringify(quote.text)}`;
}

function renderPrompt(input: NarrativeInput, limits: PromptLimits): string {
  const { facts, profile } = input;
  const focus = (input.resultsFocus ?? '').trim().slice(0, MAX_RESULTS_FOCUS_LENGTH);
  const breakdowns = profile.breakdowns.slice(0, limits.breakdowns);
  const quotes = profile.quotes.slice(0, limits.quotes);
  const leftOutQuotes = profile.quotes.length - quotes.length;
  const columns = limits.maxColumns === null ? profile.columns : profile.columns.slice(0, limits.maxColumns);
  const leftOutColumns = profile.columns.length - columns.length;

  const data = [
    [
      'COLUMNS (label in square brackets; every share is of that column\'s answers, not of all rows)',
      ...columns.map((column) => renderColumn(column, limits.countsPerColumn)),
      leftOutColumns > 0 ? `(…and ${leftOutColumns} more columns, not summarized for length)` : '',
    ].filter(Boolean).join('\n'),
    breakdowns.length > 0
      ? ['BREAKDOWNS (a tool column split by a survey column; shares are within each group)', ...breakdowns.map(renderBreakdown)].join('\n')
      : '',
    quotes.length > 0 || leftOutQuotes > 0
      ? [
        'QUOTES (verbatim respondent answers, shortened with … when long)',
        ...quotes.map(renderQuote),
        leftOutQuotes > 0 ? `(${leftOutQuotes} more quotes left out for length)` : '',
      ].filter(Boolean).join('\n')
      : '',
  ].filter(Boolean).join('\n\n');

  return [
    [
      '--- SURVEY ---',
      `File: ${facts.surveyFilename}`,
      `Rows in the file: ${facts.rowsInFile}`,
      `Rows analyzed: ${facts.rowsAnalyzed}`,
      `Rows that failed analysis: ${facts.failedRowCount}`,
    ].join('\n'),
    focus
      ? `--- RESULTS FOCUS ---\nThe person who ran this survey asked the results to emphasize:\n${focus}`
      : '--- RESULTS FOCUS ---\nNone given. Lead with whatever matters most in the data.',
    `--- DATA ---\n${DISTRIBUTION_DATA_NOTICE}\n${fenceData(data)}`,
    `--- TASK ---\n${PULSE_NARRATIVE_TASK}`,
  ].join('\n\n');
}

const SUMMARIES_ONLY: PromptLimits = { quotes: 0, countsPerColumn: 0, breakdowns: 0, maxColumns: null };

/**
 * The last resort, once every optional detail is gone and the column summaries alone are still
 * over budget: keep as many summaries as fit and count the rest. The count only shortens as
 * more columns are kept, so measuring against dropping all of them never overshoots.
 */
function renderWithinColumnBudget(input: NarrativeInput): string {
  const shell = renderPrompt(input, { ...SUMMARIES_ONLY, maxColumns: 0 }).length;
  const summaries = input.profile.columns.map((column) => renderColumn(column, 0).length + 1);
  let used = shell;
  let kept = 0;

  while (kept < summaries.length && used + summaries[kept] <= MAX_NARRATIVE_PROMPT_CHARS) {
    used += summaries[kept];
    kept += 1;
  }

  return renderPrompt(input, { ...SUMMARIES_ONLY, maxColumns: kept });
}

/**
 * The narrative's user message, capped at MAX_NARRATIVE_PROMPT_CHARS for very wide surveys.
 * Detail is shed in order — quotes, then counts past each column's top 5, then breakdowns,
 * then the remaining counts, and only then column summaries themselves.
 */
export function buildNarrativePrompt(input: NarrativeInput): string {
  const quoteCount = input.profile.quotes.length;
  const breakdownCount = input.profile.breakdowns.length;
  const attempts: PromptLimits[] = [
    ...Array.from({ length: quoteCount + 1 }, (_, dropped) => ({
      quotes: quoteCount - dropped,
      countsPerColumn: null,
      breakdowns: breakdownCount,
      maxColumns: null,
    })),
    ...Array.from({ length: breakdownCount + 1 }, (_, dropped) => ({
      quotes: 0,
      countsPerColumn: COUNTS_KEPT_WHEN_TRIMMED,
      breakdowns: breakdownCount - dropped,
      maxColumns: null,
    })),
    SUMMARIES_ONLY,
  ];

  for (const limits of attempts) {
    const prompt = renderPrompt(input, limits);

    if (prompt.length <= MAX_NARRATIVE_PROMPT_CHARS) {
      return prompt;
    }
  }

  return renderWithinColumnBudget(input);
}

export function buildNarrativeSystemPrompt(persona: string): string {
  const trimmed = persona.trim();

  return trimmed ? `${PULSE_NARRATIVE_SYSTEM_PROMPT}\n\n--- YOUR PERSONA ---\n${trimmed}` : PULSE_NARRATIVE_SYSTEM_PROMPT;
}

// Labels compare ignoring case, spacing, and which dash was typed.
function labelKey(label: string): string {
  return normalizeAnswer(label.replace(/[-‐-―]/g, '–'));
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
    .join('; ');
}

/**
 * Checks the model's JSON against the narrative schema, then keeps only column labels that
 * exist in the profile and quote ids that exist in the sample, so nothing the outputs show
 * can point at an invented column or an unverified quote.
 */
export function validateNarrative(
  raw: unknown,
  profile: PulseResultsProfile,
): { narrative: PulseNarrative } | { error: string } {
  const parsed = NARRATIVE_SCHEMA.safeParse(raw);

  if (!parsed.success) {
    return { error: formatIssues(parsed.error) };
  }

  const labels = new Map(profile.columns.map((column) => [labelKey(column.label), column]));
  const quoteIds = new Set(profile.quotes.map((quote) => quote.id));
  const known = (label: string) => labels.get(labelKey(label)) ?? null;
  const knownLabels = (list: string[], featured = false) => Array.from(new Set(list
    .map(known)
    .filter((column): column is PulseColumnProfile => (
      column !== null && (!featured || (column.kind !== 'identifier' && column.kind !== 'empty'))
    ))
    .map((column) => column.label)));
  const knownQuoteIds = (list: string[]) => Array.from(new Set(
    list.map((id) => id.trim()).filter((id) => quoteIds.has(id)),
  ));
  const { data } = parsed;
  const knownFinding = (finding: number | null) => (
    finding !== null && finding >= 1 && finding <= data.keyFindings.length ? finding : null
  );

  return {
    narrative: {
      headline: data.headline,
      overview: data.overview,
      keyFindings: data.keyFindings.map((finding) => ({
        title: finding.title,
        detail: finding.detail,
        columns: knownLabels(finding.columns),
        quoteIds: knownQuoteIds(finding.quoteIds),
        tone: finding.tone,
        whyItMatters: finding.whyItMatters,
        caveat: finding.caveat,
      })),
      recommendedActions: data.recommendedActions.map((item) => ({
        action: item.action,
        rationale: item.rationale,
        finding: knownFinding(item.finding),
      })),
      columnNotes: Object.fromEntries(Object.entries(data.columnNotes).flatMap(([label, note]) => {
        const column = known(label);
        return column && note.length > 0 ? [[column.label, note]] : [];
      })),
      featuredColumns: knownLabels(data.featuredColumns, true),
      quoteIds: knownQuoteIds(data.quoteIds),
    },
  };
}

function parseNarrative(content: string, profile: PulseResultsProfile): { narrative: PulseNarrative } | { error: string } {
  const json = parseJsonObject(content);

  return json ? validateNarrative(json, profile) : { error: 'The reply was not a single JSON object.' };
}

/**
 * Writes the results narrative in one model call from computed profiles only, with one retry
 * that shows the model what was wrong. Never throws: a failure returns a null narrative and
 * the reason, so the outputs can still render their numbers.
 */
export default async function generateNarrative(
  params: GenerateNarrativeParams,
): Promise<{ narrative: PulseNarrative | null; error: string | null }> {
  let messages: Message[] = [
    { role: 'system', content: buildNarrativeSystemPrompt(params.persona) },
    { role: 'user', content: buildNarrativePrompt(params) },
  ];
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let content: string;

    try {
      const response = await params.completionAdapter.chat({ messages });
      content = response.message.content;
    } catch (error) {
      logger.error('PULSE narrative call failed', { attempt, error: (error as Error).message });
      return { narrative: null, error: `The written summary couldn't be generated: ${(error as Error).message}` };
    }

    const result = parseNarrative(content, params.profile);

    if ('narrative' in result) {
      return { narrative: result.narrative, error: null };
    }

    lastError = result.error;
    logger.warn('PULSE narrative failed validation', { attempt, error: result.error });

    messages = [
      ...messages,
      { role: 'assistant', content },
      {
        role: 'user',
        content: `Your reply could not be used: ${result.error}\n\nReturn only the corrected JSON object, following every rule and limit above.`,
      },
    ];
  }

  return {
    narrative: null,
    error: `The written summary couldn't be generated: the model's reply wasn't in the expected format (${lastError}).`,
  };
}
