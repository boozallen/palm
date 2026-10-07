import { formatColumnLabel, isColumnLetter } from '@/features/ai-agents/utils/pulse/columnLetters';
import { sourceColumnUnresolvedError, type PulseError } from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { PulseSurveyHeader } from '@/features/ai-agents/types/pulse/surveyAnalysis';

export type SourceColumnResolution = {
  // Survey column letters, in cell order, each once.
  letters: string[];
  // Tokens that match nothing in the loaded survey.
  unresolved: string[];
  // Name-like tokens waiting for a survey to resolve against.
  held: string[];
  // The first unresolved token as a row error; null when everything resolved or was held.
  error: PulseError | null;
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// The longest run of comma-separated pieces from `start` that names a header, or null.
function headerRunAt(
  pieces: string[],
  start: number,
  headerNames: Set<string>,
): { phrase: string; nextIndex: number } | null {
  for (let end = pieces.length - 1; end >= start; end--) {
    const phrase = collapse(pieces.slice(start, end + 1).join(','));

    if (headerNames.has(normalizeName(phrase))) {
      return { phrase, nextIndex: end + 1 };
    }
  }

  return null;
}

/**
 * Commas separate, except inside a header name: the longest run of comma-separated pieces
 * that names a survey header wins, so question text like 'Overall, how did we do?' can be
 * named. Whitespace separates only when every word is a column letter ('A B C').
 */
function tokenize(cellText: string, headerNames: Set<string>): string[] {
  const pieces = cellText.split(',');
  const tokens: string[] = [];
  let index = 0;

  while (index < pieces.length) {
    const run = headerRunAt(pieces, index, headerNames);

    if (run !== null) {
      tokens.push(run.phrase);
      index = run.nextIndex;
      continue;
    }

    const phrase = collapse(pieces[index]);
    const words = phrase.split(' ');
    index += 1;

    if (phrase.length === 0) {
      continue;
    }

    if (words.length > 1 && words.every(isColumnLetter)) {
      tokens.push(...words);
    } else {
      tokens.push(phrase);
    }
  }

  return tokens;
}

/**
 * Resolves a prompt matrix Source columns cell to survey column letters. A header name wins
 * over a column letter, so a header literally named 'HOW' resolves to its own column. With no
 * survey loaded, letters are accepted provisionally and names are held for the re-parse.
 */
export default function resolveSourceColumns(
  cellText: string,
  surveyHeaders: PulseSurveyHeader[],
): SourceColumnResolution {
  const isSurveyLoaded = surveyHeaders.length > 0;
  const letterByName = new Map<string, string>();

  surveyHeaders.forEach(({ letter, header }) => {
    const name = normalizeName(header);

    if (name.length > 0 && !letterByName.has(name)) {
      letterByName.set(name, letter);
    }
  });

  const surveyLetters = new Set(surveyHeaders.map((column) => column.letter));
  const letters: string[] = [];
  const unresolved: string[] = [];
  const held: string[] = [];

  const addLetter = (letter: string) => {
    if (!letters.includes(letter)) {
      letters.push(letter);
    }
  };

  for (const token of tokenize(cellText, new Set(letterByName.keys()))) {
    const named = letterByName.get(normalizeName(token));

    if (named) {
      addLetter(named);
      continue;
    }

    const letter = token.toUpperCase();

    if (isColumnLetter(token) && (!isSurveyLoaded || surveyLetters.has(letter))) {
      addLetter(letter);
      continue;
    }

    if (isSurveyLoaded) {
      unresolved.push(token);
    } else {
      held.push(token);
    }
  }

  const error = unresolved.length > 0
    ? sourceColumnUnresolvedError(
      unresolved[0],
      surveyHeaders.map((column) => formatColumnLabel(column.letter, column.header)),
    )
    : null;

  return { letters, unresolved, held, error };
}
