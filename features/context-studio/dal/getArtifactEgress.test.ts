import { Prisma } from '@prisma/client';
import db from '@/server/db';
import getArtifactEgress, { isPutToWork } from './getArtifactEgress';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

type MockFragment = {
  strings: TemplateStringsArray;
  values: unknown[];
};

const isFragment = (value: unknown): value is MockFragment =>
  typeof value === 'object' && value !== null && 'strings' in value;

// Flattens the mocked fragment tree into the SQL text the query would actually
// run, so a test can assert on the window this DAL asked for. Deliberately a copy
// of the same helper in timeRangeFilter.test.ts rather than a shared import —
// exporting it from a test file would make Jest treat that file as a suite of its
// own, and it only makes sense against this file's `@prisma/client` mock.
const render = (value: unknown): string => {
  if (value === Prisma.empty) { return ''; }
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  return String(value);
};

const ARTIFACT_A = '11111111-1111-1111-1111-111111111111';
const ARTIFACT_B = '22222222-2222-2222-2222-222222222222';

describe('getArtifactEgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty map without querying when given no ids', async () => {
    const result = await getArtifactEgress([], TimeRange.Month, 'current');

    expect(result.size).toBe(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('marks a downloaded artifact as downloaded', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { resource_id: ARTIFACT_A, event: AuditRecordEvent.DownloadArtifact },
    ]);

    const result = await getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'current');

    expect(result.get(ARTIFACT_A)).toEqual({
      downloaded: true,
      copied: false,
      published: false,
    });
  });

  it('collapses several events on one artifact into a single summary', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { resource_id: ARTIFACT_A, event: AuditRecordEvent.DownloadArtifact },
      { resource_id: ARTIFACT_A, event: AuditRecordEvent.CopyContentToClipboard },
      { resource_id: ARTIFACT_A, event: AuditRecordEvent.PublishArtifactToGithub },
    ]);

    const result = await getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'current');

    expect(result.size).toBe(1);
    expect(result.get(ARTIFACT_A)).toEqual({
      downloaded: true,
      copied: true,
      published: true,
    });
  });

  it('attributes a bulk-download record to every artifact it names', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { resource_id: ARTIFACT_A, event: AuditRecordEvent.DownloadArtifact },
      { resource_id: ARTIFACT_B, event: AuditRecordEvent.DownloadArtifact },
    ]);

    const result = await getArtifactEgress([ARTIFACT_A, ARTIFACT_B], TimeRange.Month, 'current');

    expect(result.get(ARTIFACT_A)?.downloaded).toBe(true);
    expect(result.get(ARTIFACT_B)?.downloaded).toBe(true);
  });

  it('omits artifacts with no put-to-work signal rather than defaulting them', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { resource_id: ARTIFACT_A, event: AuditRecordEvent.DownloadArtifact },
    ]);

    const result = await getArtifactEgress([ARTIFACT_A, ARTIFACT_B], TimeRange.Month, 'current');

    expect(result.has(ARTIFACT_B)).toBe(false);
  });

  it('ignores an unrecognized event rather than inventing a signal', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { resource_id: ARTIFACT_A, event: 'SOME_FUTURE_EVENT' },
    ]);

    const result = await getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'current');

    expect(result.has(ARTIFACT_A)).toBe(false);
  });

  it('leaves the current window open-ended for late egress', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'current');

    const [strings, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];
    const sql = render({ strings, values });

    // The current window gets a lower bound only. Egress that happens after the
    // artifact's creation still counts, which is the documented late-download rule.
    //
    // Exactly one interval, not two: the pre-fix query reached back a full extra
    // interval, and a bare toMatch would pass against that too.
    expect(sql.match(/INTERVAL '30 days'/g)).toHaveLength(1);
    expect(sql).not.toContain(' < ');
  });

  it('censors the previous window at its end', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'previous');

    const [strings, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];
    const sql = render({ strings, values });

    // The previous window gets a two-sided bound. Without an upper limit, the
    // previous cohort would accrue egress for up to an extra full interval and
    // report a flat metric as a decline. Both cohorts must get identically
    // distributed observation windows. The upper bound is the critical element.
    expect(sql).toContain(' < ');
  });

  it('asks only about the ids it was given, so orphaned records drop out', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'current');

    const [strings, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];

    // `metadata.resourceIds` is deliberately not a foreign key, so an audit record
    // outlives the artifact it names — a chat artifact cascade-deletes with its
    // chat and its download record stays behind. Nothing in the mapping loop
    // filters those out, and it must not have to: the id list comes from
    // ChatArtifact rows that still exist, and binding it into the query is what
    // keeps an orphaned record from ever reaching the map. Dropping this predicate
    // would let deleted artifacts count as put to work with no denominator to
    // match. This is also the mechanism behind the downward drift the Value view
    // discloses in its caveats.
    expect(render({ strings, values })).toContain('rid = ANY(');
    expect(values).toContainEqual([ARTIFACT_A]);
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('connection reset'));

    await expect(
      getArtifactEgress([ARTIFACT_A], TimeRange.Month, 'current'),
    ).rejects.toThrow('Failed to fetch artifact usage signals');
  });
});

describe('isPutToWork', () => {
  it.each([
    ['downloaded', { downloaded: true, copied: false, published: false }],
    ['copied', { downloaded: false, copied: true, published: false }],
    ['published', { downloaded: false, copied: false, published: true }],
  ])('counts an artifact that was %s', (_signal, summary) => {
    expect(isPutToWork(summary)).toBe(true);
  });

  it('does not count an artifact no signal fired for', () => {
    expect(isPutToWork({ downloaded: false, copied: false, published: false })).toBe(false);
  });

  // An artifact absent from the map was never acted on, which the callers reach by
  // looking up an id that isn't there rather than by checking for it first.
  it('does not count an artifact missing from the map', () => {
    expect(isPutToWork(undefined)).toBe(false);
  });
});
