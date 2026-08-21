import logger from '@/server/logger';
import db from '@/server/db';
import {
  PageTransitionStats,
  TimeRange,
} from '@/features/context-studio/types/context-studio';
import { buildAuditFilters } from '@/features/context-studio/dal/auditFilters';
import { sessionizedRecords } from '@/features/context-studio/dal/sessionizedRecords';

// Pages beyond this (by total traffic) fold into a single "Other" row/column so
// the matrix stays square and legible.
const TOP_N_PAGES = 8;
const OTHER = 'Other';

// Column headers get a cell's worth of width; anything longer than this is
// abbreviated. The row label (left rail) always carries the full page name.
const MAX_SHORT_LABEL = 10;

type PairRow = {
  from_page: string;
  to_page: string;
  n: number;
};

// Abbreviates a page label for a column header: drop a trailing noun that the
// reader can infer ("Prompt Library" → "Prompt Lib"), else clip with an ellipsis.
function shortLabel(page: string): string {
  if (page.length <= MAX_SHORT_LABEL) { return page; }
  const words = page.split(' ');
  if (words.length > 1) {
    const head = words.slice(0, -1).join(' ');
    const tail = words[words.length - 1];
    const abbreviated = `${head} ${tail.slice(0, 3)}`;
    if (abbreviated.length <= MAX_SHORT_LABEL) { return abbreviated; }
    if (head.length <= MAX_SHORT_LABEL) { return head; }
  }
  return `${page.slice(0, MAX_SHORT_LABEL - 1)}…`;
}

// Consecutive same-page transitions are dropped as noise by the query's repeat
// guard below; genuine self-transitions (leaving and returning within a session)
// still count. Builds an aggregate from/to matrix over navigation events.
export default async function getPageTransitions(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<PageTransitionStats> {
  try {
    const filters = buildAuditFilters(timeRange, userGroupId, userId, excludeAdmins);

    const rows = await db.$queryRaw<PairRow[]>`
      ${sessionizedRecords(filters)},
      labeled AS (
        SELECT "userId", session_no, "timestamp",
               substring(description from 'User clicked "([^"(]+)') AS label
        FROM sessionized
        WHERE event IN ('NAVIGATION', 'UI_INTERACTION')
      ),
      paired AS (
        SELECT trim(label) AS from_page,
               trim(LEAD(label) OVER (
                 PARTITION BY "userId", session_no ORDER BY "timestamp"
               )) AS to_page
        FROM labeled
        WHERE label IS NOT NULL
      )
      SELECT from_page, to_page, COUNT(*)::int AS n
      FROM paired
      WHERE to_page IS NOT NULL
      GROUP BY from_page, to_page
      ORDER BY n DESC
    `;

    // Rank pages by total traffic (as either endpoint) and keep the top N.
    const traffic = new Map<string, number>();
    for (const r of rows) {
      traffic.set(r.from_page, (traffic.get(r.from_page) ?? 0) + r.n);
      traffic.set(r.to_page, (traffic.get(r.to_page) ?? 0) + r.n);
    }
    const topPages = Array.from(traffic.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N_PAGES)
      .map(([page]) => page);
    const topSet = new Set(topPages);
    const hasOther = traffic.size > topSet.size;

    // Fold non-top pages into "Other" on both axes, summing collisions.
    const fold = (page: string): string => (topSet.has(page) ? page : OTHER);
    const matrix: Record<string, Record<string, number>> = {};
    let totalTransitions = 0;
    for (const r of rows) {
      const from = fold(r.from_page);
      const to = fold(r.to_page);
      const row = matrix[from] ?? {};
      row[to] = (row[to] ?? 0) + r.n;
      matrix[from] = row;
      totalTransitions += r.n;
    }

    const pages = hasOther ? [...topPages, OTHER] : topPages;
    // Every page gets a row key so the client can read matrix[from] without a
    // null check, even for pages that were only ever a destination.
    for (const page of pages) {
      matrix[page] = matrix[page] ?? {};
    }
    const shortLabels = Object.fromEntries(pages.map((page) => [page, shortLabel(page)]));

    return { pages, shortLabels, matrix, totalTransitions };
  } catch (error) {
    logger.error('Error fetching page transitions', { error });
    throw new Error('Failed to fetch page transition statistics');
  }
}
