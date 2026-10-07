import resolveSourceColumns from '@/features/ai-agents/utils/pulse/resolveSourceColumns';
import { formatPulseError } from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { PulseSurveyHeader } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const SURVEY_HEADERS: PulseSurveyHeader[] = [
  { letter: 'A', header: 'ID' },
  { letter: 'B', header: 'Region' },
  { letter: 'C', header: 'Revenue' },
  { letter: 'D', header: 'How did we do?' },
];

describe('resolveSourceColumns', () => {
  it('reads column letters in either case', () => {
    expect(resolveSourceColumns('b, d', SURVEY_HEADERS).letters).toEqual(['B', 'D']);
  });

  it('reads header names regardless of case and spacing', () => {
    const result = resolveSourceColumns('region,  HOW did   we do? ', SURVEY_HEADERS);

    expect(result.letters).toEqual(['B', 'D']);
    expect(result.error).toBeNull();
  });

  it('mixes letters and header names in one cell', () => {
    expect(resolveSourceColumns('A, Revenue', SURVEY_HEADERS).letters).toEqual(['A', 'C']);
  });

  it('splits space-separated letters', () => {
    expect(resolveSourceColumns('A B C', SURVEY_HEADERS).letters).toEqual(['A', 'B', 'C']);
  });

  it('keeps a header made of letter-like words together', () => {
    const headers = [...SURVEY_HEADERS, { letter: 'E', header: 'A B' }];

    expect(resolveSourceColumns('A B', headers).letters).toEqual(['E']);
  });

  it('prefers a header name over the column letter it spells', () => {
    const headers: PulseSurveyHeader[] = [
      { letter: 'A', header: 'ID' },
      { letter: 'B', header: 'C' },
      { letter: 'C', header: 'Revenue' },
    ];

    expect(resolveSourceColumns('C', headers).letters).toEqual(['B']);
  });

  it('reads a header whose question text contains a comma', () => {
    const headers = [...SURVEY_HEADERS, { letter: 'E', header: 'Overall, how satisfied were you?' }];
    const result = resolveSourceColumns('Overall, how satisfied were you?', headers);

    expect(result.letters).toEqual(['E']);
    expect(result.error).toBeNull();
  });

  it('reads a comma-bearing header alongside another column in the same cell', () => {
    const headers = [...SURVEY_HEADERS, { letter: 'E', header: 'Overall, how satisfied were you?' }];

    expect(resolveSourceColumns('B, Overall, how satisfied were you?', headers).letters)
      .toEqual(['B', 'E']);
    expect(resolveSourceColumns('Overall, how satisfied were you?, B', headers).letters)
      .toEqual(['E', 'B']);
  });

  it('leads its fix with the column letter when a survey header contains a comma', () => {
    const headers = [{ letter: 'A', header: 'Overall, how did we do?' }];
    const result = resolveSourceColumns('Nope', headers);

    expect(result.error?.fix).toBe(
      'Use the column letter, or a whole header from: A – Overall, how did we do?',
    );
  });

  it('lists each column once however many times it is named', () => {
    expect(resolveSourceColumns('B, region, b', SURVEY_HEADERS).letters).toEqual(['B']);
  });

  it('reports a name that matches no header, listing the survey columns', () => {
    const result = resolveSourceColumns('Regoin', SURVEY_HEADERS);

    expect(result.letters).toEqual([]);
    expect(result.unresolved).toEqual(['Regoin']);
    expect(result.error && formatPulseError(result.error)).toBe(
      '\'Regoin\' doesn\'t match any survey column.\n\nFix: Use a column letter or one of: A – ID, B – Region, C – Revenue, D – How did we do?',
    );
  });

  it('reports a letter the survey does not have', () => {
    const result = resolveSourceColumns('B, Q', SURVEY_HEADERS);

    expect(result.letters).toEqual(['B']);
    expect(result.unresolved).toEqual(['Q']);
    expect(result.error?.cause).toBe('\'Q\' doesn\'t match any survey column.');
  });

  it('accepts letters and holds names until a survey is loaded', () => {
    const result = resolveSourceColumns('Q, Region', []);

    expect(result).toEqual({ letters: ['Q'], unresolved: [], held: ['Region'], error: null });
  });

  it('reads a blank cell as no columns', () => {
    expect(resolveSourceColumns('  ', SURVEY_HEADERS)).toEqual({ letters: [], unresolved: [], held: [], error: null });
  });
});
