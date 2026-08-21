import { intersection } from '@/features/graph-database/utils/similarity';

describe('intersection', () => {
  it('should return common elements', () => {
    const result = intersection(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(result).toEqual(['b', 'c']);
  });

  it('should return empty array when no overlap', () => {
    const result = intersection(['a', 'b'], ['c', 'd']);
    expect(result).toEqual([]);
  });

  it('should handle empty arrays', () => {
    expect(intersection([], ['a'])).toEqual([]);
    expect(intersection(['a'], [])).toEqual([]);
    expect(intersection([], [])).toEqual([]);
  });

  it('should handle duplicate elements correctly', () => {
    const result = intersection(['a', 'a', 'b'], ['a', 'c']);
    expect(result).toEqual(['a', 'a']); // Returns both 'a's from first array
  });

  it('should work with numbers', () => {
    const result = intersection([1, 2, 3], [2, 3, 4]);
    expect(result).toEqual([2, 3]);
  });
});
