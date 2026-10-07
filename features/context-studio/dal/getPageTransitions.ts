import logger from '@/server/logger';
import db from '@/server/db';
import {
  PageTransitionStats,
  TimeRange,
} from '@/features/context-studio/types/context-studio';
import { buildAuditFilters } from '@/features/context-studio/dal/auditFilters';
import { sessionizedRecords } from '@/features/context-studio/dal/sessionizedRecords';

type PairRow = {
  from_page: string;
  to_page: string;
  n: number;
};

// Route families where the segment after the root is a per-resource id/slug
// rather than a distinct page — collapsing them to the root keeps "pages" a
// small, stable set instead of one row per prompt/chat/workflow ever visited.
const RESOURCE_ROUTE_ROOTS = ['/chat', '/library', '/workflows', '/ai-agents'];

// Collapses a captured navigation href down to a stable page bucket: query
// string and hash fragment are dropped (same-page tab switches like
// `/settings#profile` fold into their parent page), then a resource-family
// path keeps only its root while everything else keeps up to two segments
// (e.g. `/settings/ai-agents` stays distinct from `/settings/databases`).
// A value with no leading slash is passed through untouched — legacy/malformed
// descriptions predate this and should not be silently miscategorized.
export function normalizePath(raw: string): string {
  if (!raw.startsWith('/')) { return raw; }
  const path = raw.split(/[?#]/)[0];
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) { return '/'; }
  const root = `/${segments[0]}`;
  if (RESOURCE_ROUTE_ROOTS.includes(root) || segments.length === 1) { return root; }
  return `${root}/${segments[1]}`;
}

// Consecutive same-page transitions are dropped as noise by the query's repeat
// guard below; genuine self-transitions (leaving and returning within a session)
// still count. Builds an aggregate from/to matrix over navigation events,
// covering every page that was ever a source or destination — no top-N cutoff.
export default async function getPageTransitions(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<PageTransitionStats> {
  try {
    const filters = buildAuditFilters(timeRange, userGroupId, userId, excludeAdmins);

    // The regex's `\(` / `\)` must be double-escaped here: this is a tagged
    // template literal, and Prisma's $queryRaw reads the "cooked" strings —
    // so a single backslash is consumed by JS's own escape processing before
    // the text ever reaches Postgres, leaving unbalanced parens in the pattern.
    const rawRows = await db.$queryRaw<PairRow[]>`
      ${sessionizedRecords(filters)},
      labeled AS (
        SELECT "userId", session_no, "timestamp",
               substring(description from 'User clicked "[^"(]+\\(([^)]+)\\)') AS href
        FROM sessionized
        WHERE event IN ('NAVIGATION', 'UI_INTERACTION')
      ),
      paired AS (
        SELECT trim(href) AS from_page,
               trim(LEAD(href) OVER (
                 PARTITION BY "userId", session_no ORDER BY "timestamp"
               )) AS to_page
        FROM labeled
        WHERE href IS NOT NULL
      )
      SELECT from_page, to_page, COUNT(*)::int AS n
      FROM paired
      WHERE to_page IS NOT NULL
      GROUP BY from_page, to_page
      ORDER BY n DESC
    `;

    // The SQL above grouped by raw href, so distinct per-resource URLs (every
    // prompt, chat, workflow ever visited) are still separate rows here —
    // collapse them to their normalized page bucket before ranking. The key
    // joins with a null byte, not a visible delimiter: legacy label data
    // (pre-dating href capture) can itself contain spaces, e.g. "Prompt Library".
    const normalizedCounts = new Map<string, number>();
    for (const r of rawRows) {
      const key = `${normalizePath(r.from_page)}\x00${normalizePath(r.to_page)}`;
      normalizedCounts.set(key, (normalizedCounts.get(key) ?? 0) + r.n);
    }
    const rows: PairRow[] = Array.from(normalizedCounts.entries()).map(([key, n]) => {
      const [from_page, to_page] = key.split('\x00');
      return { from_page, to_page, n };
    });

    // Every page that appeared as either endpoint gets a row/column, ranked
    // by total traffic — no top-N cutoff and no "Other" bucket.
    const traffic = new Map<string, number>();
    for (const r of rows) {
      traffic.set(r.from_page, (traffic.get(r.from_page) ?? 0) + r.n);
      traffic.set(r.to_page, (traffic.get(r.to_page) ?? 0) + r.n);
    }
    const pages = Array.from(traffic.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([page]) => page);

    const matrix: Record<string, Record<string, number>> = {};
    let totalTransitions = 0;
    for (const r of rows) {
      const row = matrix[r.from_page] ?? {};
      row[r.to_page] = (row[r.to_page] ?? 0) + r.n;
      matrix[r.from_page] = row;
      totalTransitions += r.n;
    }
    // Every page gets a row key so the client can read matrix[from] without a
    // null check, even for pages that were only ever a destination.
    for (const page of pages) {
      matrix[page] = matrix[page] ?? {};
    }

    return { pages, matrix, totalTransitions };
  } catch (error) {
    logger.error('Error fetching page transitions', { error });
    throw new Error('Failed to fetch page transition statistics');
  }
}
