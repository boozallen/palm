import { mergeDocumentMembership } from '@/features/graph-database/utils/mergeDocumentMembership';

describe('mergeDocumentMembership', () => {
  it('unions prior membership with the docs just processed', () => {
    expect(mergeDocumentMembership(['a', 'b', 'c'], ['d'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never shrinks membership when no new docs were processed (the truncation regression)', () => {
    // The bug: an incremental build queued an empty resolution base, so the
    // worker recomputed membership from [] and overwrote a 7-doc graph with 1.
    // Reading prior membership and unioning must preserve every prior doc even
    // when the processed set is empty.
    const prior = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6'];
    const result = mergeDocumentMembership(prior, []);
    expect(result).toEqual(prior.slice().sort());
    prior.forEach((id) => expect(result).toContain(id));
  });

  it('preserves all prior docs while adding one new doc (6 prior + 1 new = 7)', () => {
    const prior = ['f', 'e', 'd', 'c', 'b', 'a'];
    const result = mergeDocumentMembership(prior, ['g']);
    expect(result).toHaveLength(7);
    [...prior, 'g'].forEach((id) => expect(result).toContain(id));
  });

  it('de-duplicates docs present in both sets', () => {
    expect(mergeDocumentMembership(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns the processed set for a brand-new graph with no prior membership', () => {
    expect(mergeDocumentMembership([], ['x', 'y'])).toEqual(['x', 'y']);
  });
});
