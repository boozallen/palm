import {
  normalizeAnswer,
  parseDateAnswer,
  parseNumericAnswer,
} from '@/features/ai-agents/utils/pulse/results/parseAnswers';

describe('parseNumericAnswer', () => {
  it.each([
    ['42', 42],
    [' 3 ', 3],
    ['-2.5', -2.5],
    ['+7', 7],
    ['.5', 0.5],
    ['1,000', 1000],
    ['1,234,567.89', 1234567.89],
    ['$1,200', 1200],
    ['$ 1,200.50', 1200.5],
    ['€300', 300],
    ['£12', 12],
    ['-$5', -5],
    ['$-5', -5],
    ['45%', 45],
    ['12.5 %', 12.5],
    ['0', 0],
  ])('reads %p as %p', (input, expected) => {
    expect(parseNumericAnswer(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['12 apples'],
    ['about 12'],
    ['1,00'],
    ['1,2345'],
    ['12,'],
    ['1.2.3'],
    ['$'],
    ['%'],
    ['--5'],
    ['-$-5'],
    ['5$'],
    ['1e5'],
    ['0x1F'],
    ['Infinity'],
    ['2026-03-04'],
    ['N/A'],
  ])('rejects %p', (input) => {
    expect(parseNumericAnswer(input)).toBeNull();
  });
});

describe('parseDateAnswer', () => {
  it('reads the ISO string a spreadsheet date cell becomes', () => {
    expect(parseDateAnswer('2026-03-04T00:00:00.000Z')?.toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });

  it('reads a bare ISO date as that UTC day', () => {
    expect(parseDateAnswer('2026-03-04')?.toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });

  it('reads a zoneless ISO timestamp as UTC', () => {
    expect(parseDateAnswer('2026-03-04T10:30')?.toISOString()).toBe('2026-03-04T10:30:00.000Z');
  });

  it('reads an ISO timestamp with an offset', () => {
    expect(parseDateAnswer('2026-03-04T10:30:00+02:00')?.toISOString()).toBe('2026-03-04T08:30:00.000Z');
  });

  it.each([
    ['3/4/2026', '2026-03-04'],
    ['03/04/2026', '2026-03-04'],
    ['12/31/2025', '2025-12-31'],
    ['3-4-2026', '2026-03-04'],
    [' 3/4/2026 ', '2026-03-04'],
  ])('reads month-first %p', (input, expected) => {
    expect(parseDateAnswer(input)?.toISOString().slice(0, 10)).toBe(expected);
  });

  it.each([
    [''],
    ['2026'],
    ['42'],
    ['13/1/2026'],
    ['2/30/2026'],
    ['2026-02-30'],
    ['2026-13-01'],
    ['3/4/26'],
    ['next Tuesday'],
    ['March 4'],
  ])('rejects %p', (input) => {
    expect(parseDateAnswer(input)).toBeNull();
  });
});

describe('normalizeAnswer', () => {
  it('ignores case, surrounding space, and repeated inner space', () => {
    expect(normalizeAnswer('  Very   Positive ')).toBe('very positive');
  });
});
