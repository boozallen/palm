import { columnValuesByKey, toAnswer } from '@/features/ai-agents/utils/pulse/results/profileColumns';
import type {
  PulseColumnProfile,
  PulseQuote,
  PulseSurveyColumn,
  PulseToolColumn,
} from '@/features/ai-agents/types/pulse/results';

export const MAX_QUOTES_PER_COLUMN = 5;
export const MAX_QUOTES = 40;
export const MAX_QUOTE_CHARS = 300;

const ELLIPSIS = '…';

/**
 * Cuts at a fixed number of characters without splitting a surrogate pair — an orphaned half
 * becomes U+FFFD once encoded, which would make a "verbatim" quote not verbatim.
 */
function sliceWholeCodePoints(text: string, length: number): string {
  const cut = text.slice(0, length);

  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

// Shortens to MAX_QUOTE_CHARS including the ellipsis, ending on a whole word when there is one.
export function truncateQuote(text: string): string {
  if (text.length <= MAX_QUOTE_CHARS) {
    return text;
  }

  const cut = sliceWholeCodePoints(text, MAX_QUOTE_CHARS - ELLIPSIS.length);
  const boundary = /\s/.test(text[cut.length]) ? cut.length : cut.search(/\s\S*$/);
  const kept = boundary > 0 ? cut.slice(0, boundary) : cut;

  return `${kept.trimEnd()}${ELLIPSIS}`;
}

// `take` positions spread evenly over `count` items, always including the first and last.
function evenlySpaced(count: number, take: number): number[] {
  if (take >= count) {
    return Array.from({ length: count }, (_, index) => index);
  }
  if (take === 1) {
    return [0];
  }

  return Array.from({ length: take }, (_, index) => Math.round((index * (count - 1)) / (take - 1)));
}

/**
 * A deterministic sample of verbatim answers from free-text columns, so any quote an output
 * shows can be traced to its row. Identifier and charted columns are never quoted.
 */
export default function sampleQuotes(params: {
  profiles: PulseColumnProfile[];
  surveyColumns: PulseSurveyColumn[];
  toolColumns: PulseToolColumn[];
  rowNumbers: number[];
}): PulseQuote[] {
  const values = columnValuesByKey(params.surveyColumns, params.toolColumns);
  const quotes: PulseQuote[] = [];

  for (const profile of params.profiles) {
    if (quotes.length >= MAX_QUOTES) {
      break;
    }
    const column = values.get(profile.key);

    if (profile.kind !== 'freeText' || !column) {
      continue;
    }

    const answered = column.values.flatMap((value, row) => {
      const answer = toAnswer(value, column.source);
      return answer === null ? [] : [{ row, answer }];
    });
    const take = Math.min(MAX_QUOTES_PER_COLUMN, MAX_QUOTES - quotes.length);

    evenlySpaced(answered.length, take).forEach((position) => {
      const { row, answer } = answered[position];

      quotes.push({
        id: `q${quotes.length + 1}`,
        rowNumber: params.rowNumbers[row],
        columnKey: profile.key,
        columnLabel: profile.label,
        text: truncateQuote(answer),
      });
    });
  }

  return quotes;
}
