/**
 * Filters a scored result set by detecting score gaps.
 *
 * Walks the array (assumed sorted descending by score) and drops items where the
 * score drops below `maxDropRatio` of the previous non-exact-match item's score.
 * Exact matches (score === 1.0) are always kept.
 *
 * This prevents noisy low-relevance anchors from polluting 1-hop expansion context.
 */
export function scoreGapFilter<T extends { score: number }>(
  items: T[],
  maxDropRatio: number = 0.4
): T[] {
  if (items.length <= 1) {return items;}

  const kept: T[] = [items[0]];
  let lastNonExactScore: number | null = items[0].score < 1.0 ? items[0].score : null;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];

    // Exact matches are always kept
    if (item.score >= 1.0) {
      kept.push(item);
      continue;
    }

    // If we haven't seen a non-exact score yet, accept this item and set baseline
    if (lastNonExactScore === null) {
      kept.push(item);
      lastNonExactScore = item.score;
      continue;
    }

    // Check if this item's score drops below the ratio threshold
    if (item.score / lastNonExactScore < maxDropRatio) {
      break; // Drop this item and everything after it
    }

    kept.push(item);
    lastNonExactScore = item.score;
  }

  return kept;
}
