import { scoreGapFilter } from './scoreGapFilter';

describe('scoreGapFilter', () => {
  it('returns empty array for empty input', () => {
    expect(scoreGapFilter([])).toEqual([]);
  });

  it('returns single item as-is', () => {
    const items = [{ score: 0.5, name: 'a' }];
    expect(scoreGapFilter(items)).toEqual(items);
  });

  it('keeps all items when no score gap exceeds threshold', () => {
    const items = [
      { score: 0.60, name: 'a' },
      { score: 0.55, name: 'b' },
      { score: 0.50, name: 'c' },
      { score: 0.45, name: 'd' },
    ];
    expect(scoreGapFilter(items)).toEqual(items);
  });

  it('drops items after a large score gap', () => {
    const items = [
      { score: 0.69, name: 'Julie Yoo' },
      { score: 0.47, name: 'Jean Yang' },
      { score: 0.44, name: 'Connie Chan' },
    ];
    // 0.47 / 0.69 = 0.68 — above 0.4, kept
    // 0.44 / 0.47 = 0.94 — above 0.4, kept
    expect(scoreGapFilter(items)).toEqual(items);
  });

  it('drops items when gap exceeds threshold', () => {
    const items = [
      { score: 0.60, name: 'relevant1' },
      { score: 0.55, name: 'relevant2' },
      { score: 0.10, name: 'noise1' },  // 0.10/0.55 = 0.18 < 0.4
      { score: 0.08, name: 'noise2' },
    ];
    expect(scoreGapFilter(items)).toEqual([
      { score: 0.60, name: 'relevant1' },
      { score: 0.55, name: 'relevant2' },
    ]);
  });

  it('always keeps exact matches (score 1.0)', () => {
    const items = [
      { score: 1.0, name: 'exact-match' },
      { score: 0.50, name: 'rrf-result' },
      { score: 0.45, name: 'rrf-result2' },
    ];
    expect(scoreGapFilter(items)).toEqual(items);
  });

  it('handles exact match followed by large gap correctly', () => {
    const items = [
      { score: 1.0, name: 'exact' },
      { score: 0.03, name: 'noise' },
    ];
    // exact match has no lastNonExactScore yet, so 0.03 becomes baseline
    expect(scoreGapFilter(items)).toEqual(items);
  });

  it('handles multiple exact matches followed by RRF scores', () => {
    const items = [
      { score: 1.0, name: 'exact1' },
      { score: 1.0, name: 'exact2' },
      { score: 0.03, name: 'rrf1' },
      { score: 0.02, name: 'rrf2' },
      { score: 0.001, name: 'noise' }, // 0.001/0.02 = 0.05 < 0.4
    ];
    expect(scoreGapFilter(items)).toEqual([
      { score: 1.0, name: 'exact1' },
      { score: 1.0, name: 'exact2' },
      { score: 0.03, name: 'rrf1' },
      { score: 0.02, name: 'rrf2' },
    ]);
  });

  it('respects custom maxDropRatio', () => {
    const items = [
      { score: 0.60, name: 'a' },
      { score: 0.40, name: 'b' }, // 0.40/0.60 = 0.67
      { score: 0.20, name: 'c' }, // 0.20/0.40 = 0.50
    ];
    // With maxDropRatio 0.7, item b (0.67) is below threshold
    expect(scoreGapFilter(items, 0.7)).toEqual([
      { score: 0.60, name: 'a' },
    ]);
    // With maxDropRatio 0.4 (default), all kept
    expect(scoreGapFilter(items, 0.4)).toEqual(items);
  });
});
