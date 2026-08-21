import { reciprocalRankFusion } from './reciprocalRankFusion';

describe('reciprocalRankFusion', () => {
  it('items in both lists rank higher than items in one list', () => {
    const result = reciprocalRankFusion([['a', 'b', 'c'], ['a', 'd', 'e']]);
    const ids = result.map(r => r.id);
    expect(ids[0]).toBe('a');
  });

  it('single list preserves order', () => {
    const result = reciprocalRankFusion([['x', 'y', 'z']]);
    expect(result.map(r => r.id)).toEqual(['x', 'y', 'z']);
  });

  it('empty lists return empty', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });

  it('scores are positive and decrease with rank', () => {
    const result = reciprocalRankFusion([['a', 'b', 'c']]);
    expect(result[0].score).toBeGreaterThan(0);
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[1].score).toBeGreaterThan(result[2].score);
  });

  it('uses k=60 by default', () => {
    const result = reciprocalRankFusion([['a']]);
    expect(result[0].score).toBeCloseTo(1 / 61, 10);
  });

  it('accepts custom k value', () => {
    const result = reciprocalRankFusion([['a']], 10);
    expect(result[0].score).toBeCloseTo(1 / 11, 10);
  });

  it('accumulates scores for ids appearing in multiple lists', () => {
    const result = reciprocalRankFusion([['a'], ['a']]);
    expect(result[0].score).toBeCloseTo(2 / 61, 10);
  });
});
