import profileColumns, {
  columnValuesByKey,
  surveyColumnKey,
  toAnswer,
  toolColumnKey,
} from '@/features/ai-agents/utils/pulse/results/profileColumns';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type {
  PulseColumnProfile,
  PulseSurveyColumn,
  PulseToolColumn,
} from '@/features/ai-agents/types/pulse/results';

function survey(values: string[], letter = 'C', header = 'Answer'): PulseSurveyColumn {
  return { letter, header, values };
}

function tool(values: string[], allowedValues: string[] = [], fieldName = 'Sentiment'): PulseToolColumn {
  return {
    fieldName,
    fieldType: allowedValues.length > 0 ? PulseFieldType.CATEGORY : PulseFieldType.FREE_TEXT,
    allowedValues,
    values,
  };
}

function profileOf(values: string[]): PulseColumnProfile {
  return profileColumns({ surveyColumns: [survey(values)], toolColumns: [], rowCount: values.length })[0];
}

function repeat(value: string, times: number): string[] {
  return Array.from({ length: times }, () => value);
}

function distinct(howMany: number, prefix = 'value'): string[] {
  return Array.from({ length: howMany }, (_, index) => `${prefix} ${index}`);
}

describe('profileColumns', () => {
  describe('identifier', () => {
    it('profiles 26 distinct answers out of 26 as an identifier', () => {
      const profile = profileOf(distinct(26, 'person'));

      expect(profile.kind).toBe('identifier');
      expect(profile).toMatchObject({ distinctCount: 26 });
    });

    // At exactly 25 distinct values a column is still small enough to chart.
    it('does not profile 25 distinct answers as an identifier', () => {
      expect(profileOf(distinct(25)).kind).toBe('categorical');
    });

    it('profiles a column exactly 95% distinct as an identifier', () => {
      // 38 distinct of 40 answers = 95%.
      expect(profileOf([...distinct(38), 'value 0', 'value 1']).kind).toBe('identifier');
    });

    it('does not profile a column just under 95% distinct as an identifier', () => {
      // 37 distinct of 40 answers = 92.5%, too many to chart, so free text.
      expect(profileOf([...distinct(37), 'value 0', 'value 1', 'value 2']).kind).toBe('freeText');
    });

    it('counts distinct answers ignoring case and spacing', () => {
      // 40 distinct of 42 answers once 'PERSON 0' and ' person  1 ' merge with their twins.
      const values = [...distinct(40, 'person'), 'PERSON 0', ' person  1 '];

      expect(profileOf(values)).toMatchObject({ kind: 'identifier', distinctCount: 40 });
    });

    it('profiles unique employee IDs as an identifier', () => {
      const values = Array.from({ length: 30 }, (_, index) => `EMP-${String(index + 1).padStart(4, '0')}`);

      expect(profileOf(values)).toMatchObject({ kind: 'identifier', distinctCount: 30 });
    });

    it('profiles unique amounts as numeric, not as an identifier', () => {
      const values = Array.from({ length: 30 }, (_, index) => String(1001 + index * 37));

      expect(profileOf(values)).toMatchObject({ kind: 'numeric', min: 1001, max: 2074 });
    });

    it('profiles unique dates as a date, not as an identifier', () => {
      const values = Array.from({ length: 30 }, (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}`);

      expect(profileOf(values)).toMatchObject({ kind: 'date', min: '2026-01-01', max: '2026-01-30' });
    });
  });

  describe('rating scales', () => {
    it('profiles a 1-5 scale as categorical, ordered by value', () => {
      const profile = profileOf(['4', '5', '3', '5', '1', '4', '5', '2', '4', '5']);

      expect(profile).toMatchObject({
        kind: 'categorical',
        counts: [
          { value: '1', count: 1 },
          { value: '2', count: 1 },
          { value: '3', count: 1 },
          { value: '4', count: 3 },
          { value: '5', count: 4 },
        ],
      });
    });

    it('profiles a 0-10 scale as categorical, ordered by value', () => {
      const values = [...Array.from({ length: 11 }, (_, index) => String(10 - index)), '10', '10', '9'];
      const profile = profileOf(values);

      if (profile.kind !== 'categorical') {
        throw new Error(`expected categorical, got ${profile.kind}`);
      }
      expect(profile.counts.map((entry) => entry.value)).toEqual(
        Array.from({ length: 11 }, (_, index) => String(index)),
      );
      expect(profile.counts[10]).toEqual({ value: '10', count: 3 });
    });

    it('profiles whole numbers with more than 11 distinct values as numeric', () => {
      const values = Array.from({ length: 12 }, (_, index) => String(index));

      expect(profileOf(values).kind).toBe('numeric');
    });
  });

  describe('numeric', () => {
    it('profiles a column where exactly 90% of answers are numbers as numeric', () => {
      const profile = profileOf(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'n/a']);

      expect(profile.kind).toBe('numeric');
      // Stats come from the answers that are numbers only.
      expect(profile).toMatchObject({ min: 1, max: 9, mean: 5, median: 5 });
    });

    it('does not profile a column with 80% numbers as numeric', () => {
      expect(profileOf(['1', '2', '3', '4', '5', '6', '7', '8', 'n/a', 'unsure']).kind).toBe('categorical');
    });

    it('reads formatted money, percentages, and thousands separators as numbers', () => {
      const profile = profileOf(['$1,200.50', '$800.25', ' 1,000 ', '$1,000', '45%', '$2,000', '$950', '$1,100', '$700', '$1,050']);

      expect(profile).toMatchObject({ kind: 'numeric', min: 45, max: 2000 });
    });

    it('takes the median of an even count as the mean of the middle two', () => {
      expect(profileOf(['1.5', '2.5', '3.5', '10.5'])).toMatchObject({ kind: 'numeric', median: 3, mean: 4.5 });
    });

    it('splits the range into 10 equal-width bins and puts the maximum in the last bin', () => {
      // 0, 0.5, 1, ... 10: two answers per bin, three in the last.
      const profile = profileOf(Array.from({ length: 21 }, (_, index) => String(index / 2)));

      if (profile.kind !== 'numeric') {
        throw new Error(`expected numeric, got ${profile.kind}`);
      }
      expect(profile.bins).toHaveLength(10);
      expect(profile.bins.map((bin) => bin.count)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 3]);
      expect(profile.bins[0]).toEqual({ from: 0, to: 1, count: 2 });
      expect(profile.bins[9]).toEqual({ from: 9, to: 10, count: 3 });
    });

    it('uses no more bins than there are distinct numbers', () => {
      const profile = profileOf(['1.5', '1.5', '2.5', '2.5', '3.5', '3.5']);

      if (profile.kind !== 'numeric') {
        throw new Error(`expected numeric, got ${profile.kind}`);
      }
      expect(profile.bins).toHaveLength(3);
      expect(profile.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(6);
    });

    it('uses a single bin when every number is the same', () => {
      const profile = profileOf(['5.5', '5.5', '5.5']);

      expect(profile).toMatchObject({ kind: 'numeric', bins: [{ from: 5.5, to: 5.5, count: 3 }] });
    });
  });

  describe('date', () => {
    it('profiles spreadsheet dates by month with the earliest and latest day', () => {
      const profile = profileOf([
        '2026-01-15T00:00:00.000Z',
        '2026-01-20T00:00:00.000Z',
        '2026-03-02T00:00:00.000Z',
        '2/10/2026',
        '2025-12-31T00:00:00.000Z',
      ]);

      expect(profile).toMatchObject({
        kind: 'date',
        min: '2025-12-31',
        max: '2026-03-02',
        months: [
          { value: '2025-12', count: 1 },
          { value: '2026-01', count: 2 },
          { value: '2026-02', count: 1 },
          { value: '2026-03', count: 1 },
        ],
      });
    });

    it('profiles a column where exactly 90% of answers are dates as a date', () => {
      const dates = Array.from({ length: 9 }, (_, index) => `2026-01-0${index + 1}`);

      expect(profileOf([...dates, 'unknown']).kind).toBe('date');
    });

    it('does not profile a column with 80% dates as a date', () => {
      const dates = Array.from({ length: 8 }, (_, index) => `2026-01-0${index + 1}`);

      expect(profileOf([...dates, 'unknown', 'later']).kind).toBe('categorical');
    });
  });

  describe('categorical', () => {
    it('merges answers that differ only in case and spacing, labelled with the commonest spelling', () => {
      const profile = profileOf(['Yes', 'yes', ' Yes ', ' Yes', 'No', 'No', 'no']);

      expect(profile).toMatchObject({
        kind: 'categorical',
        counts: [{ value: 'Yes', count: 4 }, { value: 'No', count: 3 }],
      });
    });

    it('orders values by count, largest first', () => {
      const profile = profileOf([...repeat('Blue', 2), ...repeat('Red', 5), 'Green']);

      expect(profile).toMatchObject({
        counts: [{ value: 'Red', count: 5 }, { value: 'Blue', count: 2 }, { value: 'Green', count: 1 }],
      });
    });

    it('profiles more than 25 distinct values as categorical when distinct is at most 40% of answers', () => {
      // 26 distinct of 65 answers = 40%.
      const values = [...distinct(26), ...repeat('value 0', 39)];

      expect(profileOf(values).kind).toBe('categorical');
    });

    it('profiles more than 25 distinct values as free text when distinct is over 40% of answers', () => {
      // 27 distinct of 65 answers = 41.5%.
      const values = [...distinct(27), ...repeat('value 0', 38)];

      expect(profileOf(values).kind).toBe('freeText');
    });

    it('keeps the top 12 values and rolls the rest into Other', () => {
      const values = distinct(20).flatMap((value, index) => repeat(value, 20 - index));
      const profile = profileOf(values);

      if (profile.kind !== 'categorical') {
        throw new Error(`expected categorical, got ${profile.kind}`);
      }
      expect(profile.counts).toHaveLength(13);
      expect(profile.counts[0]).toEqual({ value: 'value 0', count: 20 });
      // Ranks 13-20 answered 8 down to 1 times each.
      expect(profile.counts[12]).toEqual({ value: 'Other (8 values)', count: 36 });
    });

    it('profiles a tool field with allowed values as categorical however varied its answers', () => {
      const allowed = distinct(30, 'option');
      const [profile] = profileColumns({
        surveyColumns: [],
        toolColumns: [tool(allowed, allowed)],
        rowCount: 30,
      });

      expect(profile.kind).toBe('categorical');
    });

    it('lists allowed values nobody chose with a zero count, using the allowed spelling', () => {
      const [profile] = profileColumns({
        surveyColumns: [],
        toolColumns: [tool(['positive', 'positive', 'Negative'], ['Positive', 'Neutral', 'Negative'])],
        rowCount: 3,
      });

      expect(profile).toMatchObject({
        kind: 'categorical',
        counts: [
          { value: 'Positive', count: 2 },
          { value: 'Negative', count: 1 },
          { value: 'Neutral', count: 0 },
        ],
      });
    });

    it('orders an all-numeric scale by value, not by count', () => {
      const [profile] = profileColumns({
        surveyColumns: [],
        toolColumns: [tool(['3', '3', '3', '1', '5', '5'], ['1', '2', '3', '4', '5'], 'Score')],
        rowCount: 6,
      });

      expect(profile).toMatchObject({
        counts: [
          { value: '1', count: 1 },
          { value: '2', count: 0 },
          { value: '3', count: 3 },
          { value: '4', count: 0 },
          { value: '5', count: 2 },
        ],
      });
    });
  });

  describe('free text and empty', () => {
    it('profiles varied answers that neither repeat nor look like IDs as free text', () => {
      // 30 distinct of 50 answers: over 25 distinct, over 40% distinct, under 95% distinct.
      const values = [...distinct(30, 'I would like'), ...distinct(20, 'I would like')];

      expect(profileOf(values)).toMatchObject({ kind: 'freeText', answeredCount: 50 });
    });

    it('profiles a column with no answers as empty', () => {
      const profile = profileOf(['', '  ', '']);

      expect(profile).toMatchObject({ kind: 'empty', answeredCount: 0, rowCount: 3 });
    });

    it('profiles a tool column whose every value is a fallback as empty', () => {
      const [profile] = profileColumns({
        surveyColumns: [],
        toolColumns: [tool(repeat(MATRIX_FALLBACK_VALUE, 4), ['Positive', 'Negative'])],
        rowCount: 4,
      });

      expect(profile).toMatchObject({ kind: 'empty', answeredCount: 0, fallbackCount: 4 });
    });
  });

  describe('counts and ordering', () => {
    it('counts tool fallbacks separately and leaves them out of the answers and counts', () => {
      const [profile] = profileColumns({
        surveyColumns: [],
        toolColumns: [tool(['Positive', MATRIX_FALLBACK_VALUE, '', 'Negative', MATRIX_FALLBACK_VALUE], ['Positive', 'Negative'])],
        rowCount: 5,
      });

      expect(profile).toMatchObject({
        source: 'tool',
        answeredCount: 2,
        fallbackCount: 2,
        rowCount: 5,
        counts: [{ value: 'Negative', count: 1 }, { value: 'Positive', count: 1 }],
      });
    });

    // A respondent who typed the fallback wording answered the question; only the tool's own fallback is excluded.
    it('treats the fallback wording in a survey column as an ordinary answer', () => {
      const profile = profileOf([MATRIX_FALLBACK_VALUE, 'Yes']);

      expect(profile).toMatchObject({ fallbackCount: 0, answeredCount: 2 });
    });

    it('lists survey columns in sheet order, then tool columns in matrix order, with labels and keys', () => {
      const profiles = profileColumns({
        surveyColumns: [survey(['1'], 'A', 'ID'), survey(['North'], 'C', 'Region')],
        toolColumns: [tool(['Positive'], ['Positive'], 'Sentiment'), tool(['Pricing'], [], 'Theme')],
        rowCount: 1,
      });

      expect(profiles.map((profile) => [profile.key, profile.label, profile.source])).toEqual([
        ['survey:A', 'A – ID', 'survey'],
        ['survey:C', 'C – Region', 'survey'],
        ['tool:Sentiment', 'Sentiment', 'tool'],
        ['tool:Theme', 'Theme', 'tool'],
      ]);
    });

    it('gives every column the same row count so shares share one denominator', () => {
      const profiles = profileColumns({
        surveyColumns: [survey(['a', '', 'b'], 'A'), survey(['', '', ''], 'B')],
        toolColumns: [tool(['x', MATRIX_FALLBACK_VALUE, ''])],
        rowCount: 3,
      });

      expect(profiles.map((profile) => profile.rowCount)).toEqual([3, 3, 3]);
      expect(profiles.map((profile) => profile.answeredCount)).toEqual([2, 0, 1]);
    });
  });
});

describe('column helpers', () => {
  it('builds keys that are unique across survey and tool columns', () => {
    expect(surveyColumnKey('C')).toBe('survey:C');
    expect(toolColumnKey('C')).toBe('tool:C');
  });

  it('reads a blank cell and a tool fallback as no answer', () => {
    expect(toAnswer('  ', 'survey')).toBeNull();
    expect(toAnswer(MATRIX_FALLBACK_VALUE, 'tool')).toBeNull();
    expect(toAnswer(MATRIX_FALLBACK_VALUE, 'survey')).toBe(MATRIX_FALLBACK_VALUE);
    expect(toAnswer(' Yes ', 'tool')).toBe('Yes');
  });

  it('indexes every column by key', () => {
    const map = columnValuesByKey([survey(['a'], 'B')], [tool(['x'], [], 'Theme')]);

    expect(map.get('survey:B')).toEqual({ source: 'survey', values: ['a'] });
    expect(map.get('tool:Theme')).toEqual({ source: 'tool', values: ['x'] });
  });
});
