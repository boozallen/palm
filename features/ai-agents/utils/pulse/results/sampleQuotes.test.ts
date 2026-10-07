import sampleQuotes, {
  MAX_QUOTE_CHARS,
  MAX_QUOTES,
  truncateQuote,
} from '@/features/ai-agents/utils/pulse/results/sampleQuotes';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type {
  PulseColumnKind,
  PulseColumnProfile,
  PulseSurveyColumn,
} from '@/features/ai-agents/types/pulse/results';

function profile(letter: string, kind: PulseColumnKind = 'freeText'): PulseColumnProfile {
  const base = {
    key: `survey:${letter}`,
    label: `${letter} – Comments`,
    source: 'survey' as const,
    answeredCount: 0,
    rowCount: 0,
    fallbackCount: 0,
  };

  if (kind === 'identifier') {
    return { ...base, kind, distinctCount: 30 };
  }
  if (kind === 'categorical') {
    return { ...base, kind, counts: [] };
  }
  return { ...base, kind: 'freeText' };
}

function column(letter: string, values: string[]): PulseSurveyColumn {
  return { letter, header: 'Comments', values };
}

function answers(howMany: number, prefix = 'answer'): string[] {
  return Array.from({ length: howMany }, (_, index) => `${prefix} ${index}`);
}

function rowNumbers(howMany: number): number[] {
  // Row 1 is the header, so answers start at row 2.
  return Array.from({ length: howMany }, (_, index) => index + 2);
}

describe('sampleQuotes', () => {
  it('takes 5 answers spread evenly from first to last', () => {
    const quotes = sampleQuotes({
      profiles: [profile('E')],
      surveyColumns: [column('E', answers(10))],
      toolColumns: [],
      rowNumbers: rowNumbers(10),
    });

    expect(quotes.map((quote) => quote.text)).toEqual(['answer 0', 'answer 2', 'answer 5', 'answer 7', 'answer 9']);
    expect(quotes.map((quote) => quote.rowNumber)).toEqual([2, 4, 7, 9, 11]);
  });

  it('takes every answer when a column has 5 or fewer', () => {
    const quotes = sampleQuotes({
      profiles: [profile('E')],
      surveyColumns: [column('E', answers(3))],
      toolColumns: [],
      rowNumbers: rowNumbers(3),
    });

    expect(quotes.map((quote) => quote.text)).toEqual(['answer 0', 'answer 1', 'answer 2']);
  });

  it('skips blank answers and tool fallbacks and keeps each quote on its real row', () => {
    const quotes = sampleQuotes({
      profiles: [{ ...profile('E'), key: 'tool:Theme', label: 'Theme', source: 'tool' }],
      surveyColumns: [],
      toolColumns: [{
        fieldName: 'Theme',
        fieldType: PulseFieldType.FREE_TEXT,
        allowedValues: [],
        values: ['', 'Pricing is high', MATRIX_FALLBACK_VALUE, '  ', 'Support was slow'],
      }],
      rowNumbers: [5, 6, 7, 8, 9],
    });

    expect(quotes).toEqual([
      { id: 'q1', rowNumber: 6, columnKey: 'tool:Theme', columnLabel: 'Theme', text: 'Pricing is high' },
      { id: 'q2', rowNumber: 9, columnKey: 'tool:Theme', columnLabel: 'Theme', text: 'Support was slow' },
    ]);
  });

  it('numbers quotes q1 onward across columns in column order', () => {
    const quotes = sampleQuotes({
      profiles: [profile('E'), profile('F')],
      surveyColumns: [column('E', answers(2, 'e')), column('F', answers(2, 'f'))],
      toolColumns: [],
      rowNumbers: rowNumbers(2),
    });

    expect(quotes.map((quote) => [quote.id, quote.columnKey, quote.text])).toEqual([
      ['q1', 'survey:E', 'e 0'],
      ['q2', 'survey:E', 'e 1'],
      ['q3', 'survey:F', 'f 0'],
      ['q4', 'survey:F', 'f 1'],
    ]);
  });

  it('stops at 40 quotes, taking columns in order', () => {
    const letters = 'ABCDEFGHIJ'.split('');
    const quotes = sampleQuotes({
      profiles: letters.map((letter) => profile(letter)),
      surveyColumns: letters.map((letter) => column(letter, answers(10, letter))),
      toolColumns: [],
      rowNumbers: rowNumbers(10),
    });

    expect(quotes).toHaveLength(MAX_QUOTES);
    expect(quotes[MAX_QUOTES - 1]).toMatchObject({ id: 'q40', columnKey: 'survey:H' });
    expect(quotes.some((quote) => quote.columnKey === 'survey:I')).toBe(false);
  });

  // 14 columns of 3 answers reach 39 after 13, so the last column must contribute one, not three.
  it('stops at 40 quotes when no column fills its own share', () => {
    const letters = 'ABCDEFGHIJKLMN'.split('');
    const quotes = sampleQuotes({
      profiles: letters.map((letter) => profile(letter)),
      surveyColumns: letters.map((letter) => column(letter, answers(3, letter))),
      toolColumns: [],
      rowNumbers: rowNumbers(3),
    });

    expect(quotes).toHaveLength(MAX_QUOTES);
    expect(quotes.filter((quote) => quote.columnKey === 'survey:N')).toHaveLength(1);
  });

  // Identifiers such as emails are never quoted, and categorical answers are charted instead.
  it('quotes only free-text columns', () => {
    const quotes = sampleQuotes({
      profiles: [profile('A', 'identifier'), profile('B', 'categorical'), profile('C')],
      surveyColumns: [column('A', ['a@example.org']), column('B', ['Yes']), column('C', ['Loved it'])],
      toolColumns: [],
      rowNumbers: rowNumbers(1),
    });

    expect(quotes.map((quote) => quote.text)).toEqual(['Loved it']);
  });

  it('shortens a long answer on a word boundary', () => {
    const long = 'abcdefgh '.repeat(60).trim();
    const [quote] = sampleQuotes({
      profiles: [profile('E')],
      surveyColumns: [column('E', [long])],
      toolColumns: [],
      rowNumbers: rowNumbers(1),
    });

    expect(quote.text).toBe(`${'abcdefgh '.repeat(33).trimEnd()}…`);
  });
});

describe('truncateQuote', () => {
  it('leaves an answer at the limit untouched', () => {
    const exact = 'a'.repeat(MAX_QUOTE_CHARS);

    expect(truncateQuote(exact)).toBe(exact);
  });

  it('keeps a word that ends exactly at the cut', () => {
    const text = 'word '.repeat(100).trim();
    const truncated = truncateQuote(text);
    const kept = truncated.slice(0, -1);

    // The exact length is what proves the last whole word was kept rather than dropped.
    expect(truncated).toHaveLength(MAX_QUOTE_CHARS);
    expect(truncated.endsWith('…')).toBe(true);
    expect(text.startsWith(kept)).toBe(true);
    expect(text[kept.length]).toBe(' ');
    expect(kept.endsWith('word')).toBe(true);
  });

  it('cuts a single unbroken word at the limit', () => {
    const truncated = truncateQuote('x'.repeat(500));

    expect(truncated).toBe(`${'x'.repeat(MAX_QUOTE_CHARS - 1)}…`);
  });

  // An emoji or non-BMP character is never cut in half, which would render as a replacement char.
  it('never ends a shortened answer on half a character', () => {
    const truncated = truncateQuote('🙂'.repeat(200));

    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(truncated)).toBe(false);
    expect(truncated.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS);
    expect(truncated.endsWith('🙂…')).toBe(true);
  });
});
