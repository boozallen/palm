import { TimeRange } from '@/features/context-studio/types/context-studio';
import db from '@/server/db';

import getArtifactFacts from './getArtifactFacts';

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

const ARTIFACT_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const GROUP_ID = '33333333-3333-3333-3333-333333333333';
const CREATED_AT = new Date('2026-08-20T12:00:00.000Z');

describe('getArtifactFacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when nothing was created in the period', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getArtifactFacts(TimeRange.Month, 'all', 'all', true);

    expect(result).toEqual([]);
  });

  it('maps a chat artifact row into a fact carrying its category and attributed group', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        artifact_id: ARTIFACT_ID,
        kind: 'chat',
        owner_user_id: OWNER_ID,
        created_at: CREATED_AT,
        period_window: 'current',
        use_case: 'researchAnalysis',
        user_group_id: GROUP_ID,
      },
    ]);

    const result = await getArtifactFacts(TimeRange.Month, 'all', 'all', true);

    expect(result).toEqual([
      {
        artifactId: ARTIFACT_ID,
        kind: 'chat',
        ownerUserId: OWNER_ID,
        createdAt: CREATED_AT,
        window: 'current',
        classification: 'researchAnalysis',
        userGroupId: GROUP_ID,
      },
    ]);
  });

  // The value is handed on exactly as the column holds it. Resolution belongs to
  // the pure service, so a DAL that repaired a bad value here would put the
  // vocabulary in two places.
  it('passes an unrecognized value straight through without resolving it', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        artifact_id: ARTIFACT_ID,
        kind: 'chat',
        owner_user_id: OWNER_ID,
        created_at: new Date('2026-08-20T00:00:00.000Z'),
        period_window: 'current',
        use_case: 'capture-and-proposal',
      },
    ]);

    const result = await getArtifactFacts(TimeRange.Month, 'all', 'all', true);

    expect(result[0].classification).toBe('capture-and-proposal');
  });

  // A workflow artifact has no chat and therefore no category. It is returned so
  // the headline artifact count stays whole; getValueSummary keeps it out of the
  // bars on `kind`, not on an empty classification.
  it('returns a workflow artifact with no classification', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        artifact_id: ARTIFACT_ID,
        kind: 'workflow',
        owner_user_id: OWNER_ID,
        created_at: new Date('2026-08-20T00:00:00.000Z'),
        period_window: 'current',
        use_case: null,
      },
    ]);

    const result = await getArtifactFacts(TimeRange.Month, 'all', 'all', true);

    expect(result[0].kind).toBe('workflow');
    expect(result[0].classification).toBeNull();
  });

  it('reads the category off the chat and joins nothing else to get it', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactFacts(TimeRange.Month, 'all', 'all', false);

    const sql = JSON.stringify((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).not.toContain('AgentProvider');
    expect(sql).not.toContain('PromptTag');
    // The Prompt join existed only to read a declared category off the prompt.
    // That column is gone, so the join has to go with it rather than linger.
    expect(sql).not.toContain('\\"Prompt\\"');
    expect(sql).toContain('c.\\"useCase\\"');
  });

  // getValueSummary buckets the By-team table on each artifact's own attributed
  // group, so a Lead's scoped view has to agree: a chat or workflow tagged with a
  // different group must not show up under this one just because its owner is
  // also a member.
  it('scopes both branches on the row\'s own attributed group, not only membership', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactFacts(TimeRange.Month, GROUP_ID, 'all', false);

    const sql = JSON.stringify((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).toContain('c.\\"userGroupId\\"');
    expect(sql).toContain('we.\\"userGroupId\\"');
  });

  it('tags a row created before the current window as previous', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        artifact_id: ARTIFACT_ID,
        kind: 'chat',
        owner_user_id: OWNER_ID,
        created_at: new Date('2026-07-05T12:00:00.000Z'),
        period_window: 'previous',
        use_case: null,
      },
    ]);

    const result = await getArtifactFacts(TimeRange.Month, 'all', 'all', true);

    expect(result[0].window).toBe('previous');
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('column "userId" does not exist'));

    await expect(
      getArtifactFacts(TimeRange.Month, 'all', 'all', true),
    ).rejects.toThrow('Failed to fetch work product facts');
  });

  it('constrains the YearToDate prior window to the span-matched calendar range', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactFacts(TimeRange.YearToDate, 'all', 'all', false);

    const [, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];

    // The span-matched upper bound comes from buildPreviousPeriodFilter and appears
    // in the query's interpolated values. Without it, the entire prior calendar year
    // is tagged 'previous', drifting against the span-matched adoption metrics.
    const queryStr = JSON.stringify(values);
    expect(queryStr).toContain('< NOW() - INTERVAL \'1 year\'');
  });

  it('does not alter the prior window for rolling ranges', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactFacts(TimeRange.Month, 'all', 'all', false);

    const [, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];

    // For rolling ranges, the doubled interval is already the exact prior window,
    // so the span-matched filter should reduce to a no-op. `' - INTERVAL '` is the
    // template piece that exists only where an interval is subtracted twice, so a
    // lower bound narrowed to a single interval drops it. Asserting merely on
    // `'- INTERVAL'` would pass against that regression, since any date math at all
    // contains it.
    //
    // What this does not pin: the doubled marker also appears inside the
    // span-matched clause itself, so this catches a narrowed bound only if both
    // bounds narrow together. The exact composition of each helper is pinned by
    // timeRangeFilter.test.ts; this case guards the seam.
    const queryStr = JSON.stringify(values);
    expect(queryStr).toContain('\' - INTERVAL \'');
    // The added clause is OR-shaped against the current-window start, so it can
    // only widen the row set. An AND-only bound here would silently drop the
    // prior window.
    expect(queryStr).toContain('OR (');
  });

  it('emits no prior-window predicate for Forever', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getArtifactFacts(TimeRange.Forever, 'all', 'all', false);

    const [, ...values] = (db.$queryRaw as jest.Mock).mock.calls[0];

    // Forever has no prior window, so buildPreviousPeriodFilter returns null and
    // the span-matched filter should emit Prisma.empty. An AND FALSE predicate
    // would empty the query rather than widen it. Confirm the filter is truly
    // empty: no date math and no FALSE.
    const queryStr = JSON.stringify(values);
    expect(queryStr).not.toContain('INTERVAL');
    expect(queryStr).not.toContain('FALSE');
  });
});
