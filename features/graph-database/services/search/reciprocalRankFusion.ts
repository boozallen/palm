export interface RRFItem {
  id: string;
  score: number;
}

export function reciprocalRankFusion(lists: string[][], k = 60): RRFItem[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      const rank = index + 1; // 1-based
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
