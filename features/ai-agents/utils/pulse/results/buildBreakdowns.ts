import { normalizeAnswer } from '@/features/ai-agents/utils/pulse/results/parseAnswers';
import { columnValuesByKey, toAnswer } from '@/features/ai-agents/utils/pulse/results/profileColumns';
import { isOtherBucket } from '@/features/ai-agents/utils/pulse/selectChartableDistributions';
import type {
  PulseBreakdown,
  PulseColumnProfile,
  PulseSurveyColumn,
  PulseToolColumn,
  PulseValueCount,
} from '@/features/ai-agents/types/pulse/results';

export const MIN_GROUP_VALUES = 2;
export const MAX_GROUP_VALUES = 8;
export const MIN_GROUP_ANSWERS = 5;
export const MAX_BREAKDOWNS = 10;

type CategoricalProfile = Extract<PulseColumnProfile, { kind: 'categorical' }>;

function isCategorical(profile: PulseColumnProfile): profile is CategoricalProfile {
  return profile.kind === 'categorical';
}

// Maps an answer to its position in a profile's counts; values rolled into Other map to the Other entry.
function indexer(counts: PulseValueCount[]): (answer: string) => number | null {
  const byKey = new Map(counts.map((entry, index) => [normalizeAnswer(entry.value), index]));
  const last = counts.length - 1;
  const otherIndex = last >= 0 && isOtherBucket(counts[last].value) ? last : null;

  return (answer) => byKey.get(normalizeAnswer(answer)) ?? otherIndex;
}

// The widest gap between any large-enough group's share of a value and that value's overall share.
function scoreOf(overall: number[], groups: PulseBreakdown['groups']): number | null {
  const overallTotal = overall.reduce((sum, count) => sum + count, 0);
  const eligible = groups.filter((group) => group.total >= MIN_GROUP_ANSWERS);

  if (overallTotal === 0 || eligible.length === 0) {
    return null;
  }

  return Math.max(...eligible.flatMap((group) => group.counts.map(
    (count, index) => Math.abs(count / group.total - overall[index] / overallTotal),
  )));
}

function crossTab(
  toolProfile: CategoricalProfile,
  toolValues: string[],
  groupProfile: CategoricalProfile,
  groupValues: string[],
): PulseBreakdown | null {
  const toolIndex = indexer(toolProfile.counts);
  const groupIndex = indexer(groupProfile.counts);
  const table = groupProfile.counts.map(() => toolProfile.counts.map(() => 0));

  toolValues.forEach((value, row) => {
    const toolAnswer = toAnswer(value, 'tool');
    const groupAnswer = toAnswer(groupValues[row] ?? '', 'survey');

    if (toolAnswer === null || groupAnswer === null) {
      return;
    }

    const column = toolIndex(toolAnswer);
    const group = groupIndex(groupAnswer);

    if (column !== null && group !== null) {
      table[group][column] += 1;
    }
  });

  const groups = groupProfile.counts.map((entry, index) => ({
    group: entry.value,
    total: table[index].reduce((sum, count) => sum + count, 0),
    counts: table[index],
  }));
  const overall = toolProfile.counts.map((_, column) => table.reduce((sum, counts) => sum + counts[column], 0));
  const score = scoreOf(overall, groups);

  if (score === null) {
    return null;
  }

  return {
    toolKey: toolProfile.key,
    toolLabel: toolProfile.label,
    groupKey: groupProfile.key,
    groupLabel: groupProfile.label,
    values: toolProfile.counts.map((entry) => entry.value),
    overall,
    groups,
    score,
  };
}

/**
 * Every categorical tool column split by every categorical survey column with 2-8 values,
 * scored by how far the most different group strays from the overall mix, top 10 kept.
 * Fallbacks and blank groups are not counted.
 */
export default function buildBreakdowns(params: {
  profiles: PulseColumnProfile[];
  surveyColumns: PulseSurveyColumn[];
  toolColumns: PulseToolColumn[];
}): PulseBreakdown[] {
  const values = columnValuesByKey(params.surveyColumns, params.toolColumns);
  const categorical = params.profiles.filter(isCategorical);
  const tools = categorical.filter((profile) => profile.source === 'tool');
  const groupings = categorical.filter((profile) => (
    profile.source === 'survey'
    && profile.counts.length >= MIN_GROUP_VALUES
    && profile.counts.length <= MAX_GROUP_VALUES
  ));

  const candidates = tools.flatMap((toolProfile) => groupings.flatMap((groupProfile) => {
    const toolValues = values.get(toolProfile.key)?.values;
    const groupValues = values.get(groupProfile.key)?.values;

    if (!toolValues || !groupValues) {
      return [];
    }

    const breakdown = crossTab(toolProfile, toolValues, groupProfile, groupValues);

    return breakdown ? [breakdown] : [];
  }));

  return candidates
    .map((breakdown, order) => ({ breakdown, order }))
    .sort((a, b) => b.breakdown.score - a.breakdown.score || a.order - b.order)
    .slice(0, MAX_BREAKDOWNS)
    .map(({ breakdown }) => breakdown);
}
