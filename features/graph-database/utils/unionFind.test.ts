import { UnionFind } from '@/features/graph-database/utils/unionFind';

describe('UnionFind', () => {
  it('keeps unconnected elements in separate singleton groups', () => {
    const uf = new UnionFind<string>();
    uf.add('a');
    uf.add('b');
    uf.add('c');

    const groups = uf.groups();
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.length)).toEqual([1, 1, 1]);
  });

  it('merges transitively: union(a,b) + union(b,c) => one group {a,b,c}', () => {
    const uf = new UnionFind<string>();
    uf.union('a', 'b');
    uf.union('b', 'c');

    const groups = uf.groups();
    expect(groups).toHaveLength(1);
    expect([...groups[0]].sort()).toEqual(['a', 'b', 'c']);
    expect(uf.find('a')).toBe(uf.find('c'));
  });

  it('keeps two disjoint clusters distinct', () => {
    const uf = new UnionFind<number>();
    uf.union(1, 2);
    uf.union(3, 4);
    uf.union(4, 5);

    const groups = uf.groups();
    expect(groups).toHaveLength(2);
    const sizes = groups.map((g) => g.length).sort();
    expect(sizes).toEqual([2, 3]);
  });

  it('bridges two previously-separate clusters when a connecting union arrives', () => {
    const uf = new UnionFind<string>();
    uf.union('a', 'b'); // cluster 1
    uf.union('c', 'd'); // cluster 2
    expect(uf.groups()).toHaveLength(2);

    uf.union('b', 'c'); // bridge
    const groups = uf.groups();
    expect(groups).toHaveLength(1);
    expect([...groups[0]].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is deterministic: same operations produce identical group structure', () => {
    const build = () => {
      const uf = new UnionFind<string>();
      ['x', 'y', 'z', 'w', 'q'].forEach((n) => uf.add(n));
      uf.union('x', 'y');
      uf.union('z', 'w');
      uf.union('y', 'z');
      return uf.groups();
    };

    const a = build();
    const b = build();
    expect(a).toEqual(b);
    // {x,y,z,w} merged, {q} singleton
    expect(a.map((g) => g.length).sort()).toEqual([1, 4]);
  });

  it('preserves insertion order within groups and across groups', () => {
    const uf = new UnionFind<string>();
    ['a', 'b', 'c', 'd'].forEach((n) => uf.add(n));
    uf.union('a', 'c');

    const groups = uf.groups();
    // First group rooted at first-inserted member 'a'; members in insertion order.
    expect(groups[0]).toEqual(['a', 'c']);
    expect(groups[1]).toEqual(['b']);
    expect(groups[2]).toEqual(['d']);
  });

  it('union is idempotent (re-unioning already-merged elements is a no-op)', () => {
    const uf = new UnionFind<string>();
    uf.union('a', 'b');
    uf.union('a', 'b');
    uf.union('b', 'a');
    expect(uf.groups()).toHaveLength(1);
    expect([...uf.groups()[0]].sort()).toEqual(['a', 'b']);
  });
});
