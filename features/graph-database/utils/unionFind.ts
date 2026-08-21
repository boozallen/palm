/**
 * Generic union-find (disjoint-set) with path compression and union by rank.
 *
 * Used by both the V2 blocking pass (connected components over the candidate
 * KNN graph) and confirmed-edge clustering (closure over confirmed IDENTITY
 * edges). Kept dependency-free and pure.
 *
 * DETERMINISM: element identity and ordering are tracked by first-insertion
 * order, and rank ties are broken by the lower insertion index. `groups()`
 * therefore returns a stable, reproducible partition for a given sequence of
 * `add`/`union` calls — required so blocking and shadow comparisons are
 * reproducible. Never uses Math.random.
 */
export class UnionFind<T> {
  private indexOf = new Map<T, number>();
  private items: T[] = [];
  private parent: number[] = [];
  private rank: number[] = [];

  /** Register an element (idempotent). Returns its internal index. */
  add(x: T): number {
    const existing = this.indexOf.get(x);
    if (existing !== undefined) {
      return existing;
    }
    const idx = this.items.length;
    this.indexOf.set(x, idx);
    this.items.push(x);
    this.parent.push(idx);
    this.rank.push(0);
    return idx;
  }

  /** Find the representative element of x's set (adds x if unknown). */
  find(x: T): T {
    const idx = this.add(x);
    return this.items[this.findRoot(idx)];
  }

  /** Merge the sets containing a and b (adds either if unknown). */
  union(a: T, b: T): void {
    const rootA = this.findRoot(this.add(a));
    const rootB = this.findRoot(this.add(b));
    if (rootA === rootB) {
      return;
    }

    // Union by rank; break ties deterministically toward the lower index so
    // the chosen root is reproducible regardless of call order nuances.
    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
    } else if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
    } else {
      const [keep, attach] = rootA < rootB ? [rootA, rootB] : [rootB, rootA];
      this.parent[attach] = keep;
      this.rank[keep]++;
    }
  }

  /**
   * Return the disjoint sets as arrays of elements.
   *
   * Groups appear in the order their first member was inserted; members within
   * a group are in insertion order.
   */
  groups(): T[][] {
    const byRoot = new Map<number, T[]>();
    for (let idx = 0; idx < this.items.length; idx++) {
      const root = this.findRoot(idx);
      let group = byRoot.get(root);
      if (!group) {
        group = [];
        byRoot.set(root, group);
      }
      group.push(this.items[idx]);
    }
    return Array.from(byRoot.values());
  }

  private findRoot(idx: number): number {
    let root = idx;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    // Path compression.
    let cur = idx;
    while (this.parent[cur] !== root) {
      const next = this.parent[cur];
      this.parent[cur] = root;
      cur = next;
    }
    return root;
  }
}
