import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { EgressSummary } from '@/features/context-studio/types/value';
import { buildWindowFilter, PeriodWindow } from '@/features/context-studio/dal/timeRangeFilter';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

// The three events that mean a human took a work product out of PALM and into
// their real work. Already instrumented with metadata.resourceIds naming the
// exact artifact — see features/shared/hooks/useTrackClientEvent.ts.
//
// HIGHLIGHT_RESPONSE_TEXT and EXTERNAL_NAVIGATION are deliberately excluded: too
// weak to defend to a leadership audience.
const EGRESS_EVENTS: string[] = [
  AuditRecordEvent.DownloadArtifact,
  AuditRecordEvent.CopyContentToClipboard,
  AuditRecordEvent.PublishArtifactToGithub,
];

function emptySummary(): EgressSummary {
  return { downloaded: false, copied: false, published: false };
}

// What "put to work" means, defined once next to the events it reads. Every view
// that reports the figure shares this, so the drawer cannot disagree with the
// headline tile about the same artifact.
export function isPutToWork(summary: EgressSummary | undefined): boolean {
  return Boolean(summary && (summary.downloaded || summary.copied || summary.published));
}

export default async function getArtifactEgress(
  artifactIds: string[],
  timeRange: TimeRange,
  window: PeriodWindow,
): Promise<Map<string, EgressSummary>> {
  const result = new Map<string, EgressSummary>();

  if (artifactIds.length === 0) {
    return result;
  }

  try {
    // Filters on event + outcome + timestamp first so the existing
    // [event, outcome, timestamp] index carries the scan, then explodes the id
    // array. The time bound is sound as well as fast: an artifact created inside
    // the period cannot have been acted on before it existed. For the previous
    // window, the bound is two-sided — censoring egress at the window's end so
    // both cohorts get identically distributed observation periods and the delta
    // compares like with like.
    const rows = await db.$queryRaw<{ resource_id: string; event: string }[]>`
      SELECT DISTINCT rid AS resource_id, ar."event" AS event
      FROM "AuditRecord" ar
      CROSS JOIN LATERAL jsonb_array_elements_text(ar."metadata"->'resourceIds') AS rid
      WHERE ar."event" = ANY(${EGRESS_EVENTS})
        AND ar."outcome" = ${AuditRecordOutcome.Success}
        AND jsonb_typeof(ar."metadata"->'resourceIds') = 'array'
        AND rid = ANY(${artifactIds})
        ${buildWindowFilter(timeRange, 'ar."timestamp"', window)}
    `;

    rows.forEach((row) => {
      const summary = result.get(row.resource_id) ?? emptySummary();

      if (row.event === AuditRecordEvent.DownloadArtifact) {
        summary.downloaded = true;
      } else if (row.event === AuditRecordEvent.CopyContentToClipboard) {
        summary.copied = true;
      } else if (row.event === AuditRecordEvent.PublishArtifactToGithub) {
        summary.published = true;
      } else {
        // An event we do not recognize contributes nothing. Returning early
        // keeps an unrecognized row from creating an all-false entry, which
        // would misreport the artifact as "asked about but never used".
        return;
      }

      result.set(row.resource_id, summary);
    });

    return result;
  } catch (error) {
    logger.error('Failed to fetch artifact egress signals from AuditRecord', { error });
    throw new Error('Failed to fetch artifact usage signals');
  }
}
