import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';

import getArtifactEgress from './getArtifactEgress';
import getArtifactFacts from './getArtifactFacts';
import getAdoptionMetrics from './getAdoptionMetrics';
import getSpendFacts from './getSpendFacts';
import getTimeInTool from './getTimeInTool';
import getValueSummary, { UNATTRIBUTED_TEAM_LABEL } from './getValueSummary';

jest.mock('./getAdoptionMetrics');
// The egress lookup is mocked, but not the shared predicate that reads its result —
// the whole point of sharing it is that every caller applies the same rule.
jest.mock('./getArtifactEgress', () => ({
  __esModule: true,
  default: jest.fn(),
  isPutToWork: jest.requireActual('./getArtifactEgress').isPutToWork,
}));
jest.mock('./getArtifactFacts');
jest.mock('./getSpendFacts');
jest.mock('./getTimeInTool');
jest.mock('@/server/logger');
jest.mock('@/server/db', () => ({
  userGroupMembership: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
}));

const CAPTURE_OPS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GROWTH_TEAM = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';
const NOMAD = '33333333-3333-3333-3333-333333333333';

const DEFAULT_USE_CASE = 'proposalCapture';

// `?? DEFAULT` would be wrong here: several tests below need an uncategorized row
// and say so by passing `useCase: null`. Coalescing would quietly hand them the
// default and the test would assert a category it never exercised.
const categoryOf = (overrides: { useCase?: string | null }): string | null => (
  'useCase' in overrides ? overrides.useCase ?? null : DEFAULT_USE_CASE
);

const artifact = (
  artifactId: string,
  ownerUserId: string,
  overrides: Partial<{
    window: 'current' | 'previous';
    kind: 'chat' | 'workflow';
    useCase: string | null;
    userGroupId: string | null;
  }> = {},
) => ({
  artifactId,
  kind: overrides.kind ?? ('chat' as const),
  ownerUserId,
  createdAt: new Date('2026-08-20T12:00:00.000Z'),
  window: overrides.window ?? ('current' as const),
  classification: categoryOf(overrides),
  userGroupId: overrides.userGroupId ?? null,
});

const spend = (
  userId: string,
  cost: number,
  overrides: Partial<{
    bucket: 'system' | 'platform' | 'workflow' | 'customAgent' | 'unattributed' | 'chat';
    useCase: string | null;
    userGroupId: string | null;
  }> = {},
) => ({
  userId,
  cost,
  bucket: overrides.bucket ?? ('chat' as const),
  classification: categoryOf(overrides),
  userGroupId: overrides.userGroupId ?? null,
});

const putToWork = (...ids: string[]) =>
  new Map(ids.map((id) => [id, { downloaded: true, copied: false, published: false }]));

// Alice and Bob are in Capture Ops; Bob is also in Growth Team; Nomad has no
// group at all. That covers the single-group, multi-group and unattributed cases
// in one fixture.
const MEMBERSHIPS = [
  { userId: ALICE, userGroupId: CAPTURE_OPS, userGroup: { label: 'Capture Ops' } },
  { userId: BOB, userGroupId: CAPTURE_OPS, userGroup: { label: 'Capture Ops' } },
  { userId: BOB, userGroupId: GROWTH_TEAM, userGroup: { label: 'Growth Team' } },
];

const ALL_GROUPS = [CAPTURE_OPS, GROWTH_TEAM];

const mockDependencies = (overrides: {
  adoption?: Partial<ReturnType<typeof baseAdoption>>;
  artifacts?: ReturnType<typeof artifact>[];
  spendFacts?: ReturnType<typeof spend>[];
  egress?: Map<string, { downloaded: boolean; copied: boolean; published: boolean }>;
  hours?: number;
} = {}) => {
  (getAdoptionMetrics as jest.Mock).mockResolvedValue({
    ...baseAdoption(),
    ...overrides.adoption,
  });
  (getArtifactFacts as jest.Mock).mockResolvedValue(overrides.artifacts ?? []);
  (getSpendFacts as jest.Mock).mockResolvedValue(overrides.spendFacts ?? []);
  (getArtifactEgress as jest.Mock).mockResolvedValue(overrides.egress ?? new Map());
  (getTimeInTool as jest.Mock).mockResolvedValue(overrides.hours ?? 0);
  (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue(MEMBERSHIPS);
  (db.user.findMany as jest.Mock).mockResolvedValue([
    { id: ALICE },
    { id: BOB },
    { id: NOMAD },
  ]);
};

const baseAdoption = () => ({
  provisionedPeople: 10,
  activePeople: { value: 2, previous: 1 },
  returningPeople: { value: 1, previous: 0 },
  activeAttributions: [
    { userId: ALICE, userGroupId: CAPTURE_OPS },
    { userId: BOB, userGroupId: CAPTURE_OPS },
  ],
});

describe('getValueSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the adoption metrics through untouched', async () => {
    mockDependencies();

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.provisionedPeople).toBe(10);
    expect(result.activePeople).toEqual({ value: 2, previous: 1 });
    expect(result.returningPeople).toEqual({ value: 1, previous: 0 });
  });

  it('counts work products and put-to-work per window', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', ALICE),
        artifact('art-2', ALICE),
        artifact('art-3', BOB, { window: 'previous' }),
      ],
      egress: putToWork('art-1', 'art-3'),
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.artifacts).toEqual({ value: 2, previous: 1 });
    expect(result.putToWork).toEqual({ value: 1, previous: 1 });
  });

  // The bars sum to categorized chat spend, and that plus the remainder lines sums
  // to the total. Asserted as two steps rather than one: an uncategorized chat is
  // bucketed away from the bars by getSpendFacts, so the bars no longer cover every
  // dollar — but nothing may leave the total, which is what keeps the panel
  // reconcilable against the Cost tab.
  it('sums use-case spend to the categorized chat cost, and reconciles that to the total', async () => {
    mockDependencies({
      spendFacts: [
        spend(ALICE, 7610, { useCase: 'proposalCapture' }),
        spend(BOB, 1720, { useCase: 'policyCompliance' }),
        spend(ALICE, 1000, { useCase: 'nothing-recognized' }),
        spend(NOMAD, 2150, { bucket: 'unattributed', useCase: null }),
      ],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    const summed = result.byUseCase.reduce((total, row) => total + row.cost, 0);
    expect(summed).toBe(result.chatCost);
    expect(result.chatCost).toBe(10330);
    expect(result.chatCost + result.remainder.unattributed).toBe(result.totalCost);
    expect(result.totalCost).toBe(12480);
  });

  // An unrecognized string is a finding: something wrote a category we cannot read,
  // so Unclassified is the honest bucket. This is the case that must keep working
  // after null stopped resolving there.
  it('still resolves an unrecognized category string to Unclassified', async () => {
    mockDependencies({
      spendFacts: [spend(ALICE, 500, { useCase: 'nothing-recognized' })],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);
    const unclassified = result.byUseCase.find((row) => row.useCase === UseCase.Unclassified);

    expect(unclassified?.cost).toBe(500);
  });

  it('reports every use case in fixed taxonomy order, including empty ones', async () => {
    mockDependencies({ spendFacts: [spend(ALICE, 100, { useCase: 'proposalCapture' })] });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.byUseCase.map((row) => row.useCase)).toEqual([
      UseCase.ProposalCapture,
      UseCase.PolicyCompliance,
      UseCase.ResearchAnalysis,
      UseCase.DataAnalytics,
      UseCase.Engineering,
      UseCase.WritingCommunication,
      UseCase.ProgramDelivery,
      UseCase.TrialTest,
      UseCase.Unclassified,
    ]);
  });

  it('divides total spend by put-to-work work products for the unit cost', async () => {
    mockDependencies({
      artifacts: [artifact('art-1', ALICE), artifact('art-2', ALICE)],
      egress: putToWork('art-1', 'art-2'),
      spendFacts: [spend(ALICE, 100)],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.costPerPutToWork).toBe(50);
  });

  it('returns a null unit cost rather than zero when nothing was put to work', async () => {
    mockDependencies({
      artifacts: [artifact('art-1', ALICE)],
      spendFacts: [spend(ALICE, 100)],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.costPerPutToWork).toBeNull();
  });

  // Bob belongs to both teams, but that membership no longer decides attribution:
  // each fact carries the one group it was actually attributed to, so his two
  // actions land on two different rows instead of both rows getting both.
  it('buckets a fact by its own attributed group, not by every group its owner belongs to', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', BOB, { userGroupId: CAPTURE_OPS }),
        artifact('art-2', BOB, { userGroupId: GROWTH_TEAM }),
      ],
      spendFacts: [
        spend(BOB, 300, { userGroupId: CAPTURE_OPS }),
        spend(BOB, 150, { userGroupId: GROWTH_TEAM }),
      ],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    const capture = result.byTeam.find((row) => row.userGroupId === CAPTURE_OPS);
    const growth = result.byTeam.find((row) => row.userGroupId === GROWTH_TEAM);

    expect(capture?.artifacts).toBe(1);
    expect(growth?.artifacts).toBe(1);
    expect(capture?.cost).toBe(300);
    expect(growth?.cost).toBe(150);
  });

  it('files work by someone with no group under the unattributed row', async () => {
    mockDependencies({
      artifacts: [artifact('art-1', NOMAD)],
      spendFacts: [spend(NOMAD, 42)],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    const unattributed = result.byTeam.find((row) => row.userGroupId === null);

    expect(unattributed?.label).toBe(UNATTRIBUTED_TEAM_LABEL);
    expect(unattributed?.artifacts).toBe(1);
    expect(unattributed?.cost).toBe(42);
    expect(unattributed?.members).toBe(0);
  });

  it('distributes active people from adoption metrics without artifact-based duplication', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', ALICE, { userGroupId: CAPTURE_OPS }),
        artifact('art-2', ALICE, { userGroupId: CAPTURE_OPS }),
        artifact('art-3', ALICE, { userGroupId: CAPTURE_OPS }),
      ],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    const capture = result.byTeam.find((row) => row.userGroupId === CAPTURE_OPS);

    // Capture Ops has 2 active users (Alice and Bob) from adoption metrics. A
    // naive per-artifact increment would count Alice 3 times and yield 3, but the
    // Set-based implementation correctly yields 2.
    expect(capture?.activePeople).toBe(2);
    expect(capture?.members).toBe(2);
  });

  it('ranks teams by spend', async () => {
    mockDependencies({
      spendFacts: [spend(ALICE, 10, { userGroupId: CAPTURE_OPS }), spend(NOMAD, 500)],
    });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.byTeam[0].userGroupId).toBeNull();
  });

  it('looks put-to-work up with one call per window', async () => {
    mockDependencies({
      artifacts: [artifact('art-1', ALICE), artifact('art-2', BOB, { window: 'previous' })],
    });

    await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(getArtifactEgress).toHaveBeenCalledTimes(2);
    expect(getArtifactEgress).toHaveBeenCalledWith(['art-1'], TimeRange.Month, 'current');
    expect(getArtifactEgress).toHaveBeenCalledWith(['art-2'], TimeRange.Month, 'previous');
  });

  // Each window's figure has to read its OWN egress map. Feeding both from one
  // map is precisely the bug the two-call split exists to kill, and doing it at
  // the JS layer instead of in SQL would otherwise leave the suite green.
  it('pairs each window with its own egress map', async () => {
    mockDependencies({
      artifacts: [artifact('art-1', ALICE), artifact('art-2', BOB, { window: 'previous' })],
    });

    const downloaded = { downloaded: true, copied: false, published: false };
    (getArtifactEgress as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(new Map([['art-1', downloaded]]))
      .mockResolvedValueOnce(new Map([['art-2', downloaded]]));

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    // Cross-wiring the maps zeroes one of these: art-2 is absent from the current
    // window's map, and art-1 from the previous window's.
    expect(result.putToWork.value).toBe(1);
    expect(result.putToWork.previous).toBe(1);
  });

  // The spec's first honest-numbers rule: our own usage must never inflate
  // adoption. Every scoped dependency has to hear about it, and so does the
  // member count this DAL computes itself — a team whose denominator counted
  // admins would report a lower adoption rate than it has earned.
  it('propagates admin exclusion to every scoped dependency', async () => {
    mockDependencies();

    await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(getAdoptionMetrics).toHaveBeenCalledWith(TimeRange.Month, 'all', 'all', true);
    expect(getArtifactFacts).toHaveBeenCalledWith(TimeRange.Month, 'all', 'all', true);
    expect(getSpendFacts).toHaveBeenCalledWith(TimeRange.Month, 'all', 'all', true);
    expect(getTimeInTool).toHaveBeenCalledWith(TimeRange.Month, 'all', 'all', true);
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: { not: 'Admin' } },
      select: { id: true },
    });
  });

  it('keeps an admin out of a team member count', async () => {
    const ADMIN = '44444444-4444-4444-4444-444444444444';

    mockDependencies({ spendFacts: [spend(ALICE, 100, { userGroupId: CAPTURE_OPS })] });
    // The admin belongs to Capture Ops but is absent from the non-admin user
    // list, which is exactly the shape the real queries return.
    (db.userGroupMembership.findMany as jest.Mock).mockResolvedValue([
      ...MEMBERSHIPS,
      { userId: ADMIN, userGroupId: CAPTURE_OPS, userGroup: { label: 'Capture Ops' } },
    ]);

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    const captureOps = result.byTeam.find((team) => team.userGroupId === CAPTURE_OPS);
    // Alice and Bob. Three would mean the admin reached the denominator.
    expect(captureOps?.members).toBe(2);
  });

  it('reports measured hours and hours per active person per week', async () => {
    mockDependencies({ hours: 1740, adoption: { activePeople: { value: 156, previous: 100 } } });

    const result = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(result.hoursInTool).toBe(1740);
    // 1,740 hrs ÷ 156 people ÷ (30/7) weeks
    expect(result.hoursPerPersonPerWeek).toBe(2.6);
  });

  it('returns a null weekly rate when the range has no fixed span', async () => {
    mockDependencies({ hours: 1740 });

    const result = await getValueSummary(TimeRange.Forever, 'all', 'all', true, ALL_GROUPS);

    expect(result.hoursPerPersonPerWeek).toBeNull();
  });

  it('returns a null weekly rate for a one-day window', async () => {
    mockDependencies({ hours: 24, adoption: { activePeople: { value: 10, previous: 5 } } });

    const result = await getValueSummary(TimeRange.Day, 'all', 'all', true, ALL_GROUPS);

    // A single day is not a week, and the 7x extrapolation would misrepresent the
    // data. The label promises a weekly rate, so we return null instead.
    expect(result.hoursPerPersonPerWeek).toBeNull();
  });

  it('scopes the membership read to the specified groups', async () => {
    mockDependencies({ spendFacts: [spend(ALICE, 100)] });

    await getValueSummary(TimeRange.Month, 'all', 'all', true, [CAPTURE_OPS]);

    expect(db.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: { userGroupId: { in: [CAPTURE_OPS] } },
      select: {
        userId: true,
        userGroupId: true,
        userGroup: { select: { label: true } },
      },
    });
  });

  it('counts put-to-work per category, not only per team', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', ALICE, { useCase: 'proposalCapture' }),
        artifact('art-2', ALICE, { useCase: 'proposalCapture' }),
        artifact('art-3', BOB, { useCase: 'engineering' }),
      ],
      egress: putToWork('art-1', 'art-3'),
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);
    const byUseCase = new Map(summary.byUseCase.map((entry) => [entry.useCase, entry]));

    expect(byUseCase.get(UseCase.ProposalCapture)).toMatchObject({ artifacts: 2, putToWork: 1 });
    expect(byUseCase.get(UseCase.Engineering)).toMatchObject({ artifacts: 1, putToWork: 1 });
  });

  // The bars' put-to-work total may be below the headline's — a workflow artifact
  // that was downloaded counts there and not here — but it can never exceed it.
  // Above it would mean the same artifact counted twice.
  it('never claims more put to work across categories than the headline reports', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', ALICE, { useCase: 'proposalCapture' }),
        artifact('art-2', BOB, { useCase: 'engineering' }),
        artifact('art-3', BOB, { useCase: null }),
      ],
      egress: putToWork('art-1', 'art-2', 'art-3'),
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);
    const acrossCategories = summary.byUseCase.reduce((total, entry) => total + entry.putToWork, 0);

    // Two, not three: art-3's chat was never categorized, so it has no row to count
    // on. It still reaches the headline, which is the gap this assertion bounds.
    expect(acrossCategories).toBe(2);
    expect(acrossCategories).toBeLessThanOrEqual(summary.putToWork.value);
  });

  // The artifact side of the same rule the spend side enforces in getSpendFacts. If
  // these two ever disagree, one row's `made` column and its `spend` column describe
  // different populations of chats and the cost-per-used figure beside them is
  // arithmetic over two unrelated numbers.
  it('keeps artifacts from an uncategorized chat out of the bars but in the headline', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', ALICE, { useCase: 'engineering' }),
        artifact('art-2', BOB, { useCase: null }),
      ],
      egress: putToWork('art-1', 'art-2'),
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);
    const barMade = summary.byUseCase.reduce((total, entry) => total + entry.artifacts, 0);
    const unclassified = summary.byUseCase.find((row) => row.useCase === UseCase.Unclassified);

    expect(summary.artifacts.value).toBe(2);
    expect(barMade).toBe(1);
    expect(unclassified?.artifacts).toBe(0);
  });

  it('reports a category with nothing put to work as zero, never as absent', async () => {
    mockDependencies({
      artifacts: [artifact('art-1', ALICE, { useCase: 'trialTest' })],
      egress: new Map(),
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);
    const trial = summary.byUseCase.find((entry) => entry.useCase === UseCase.TrialTest);

    expect(trial).toMatchObject({ artifacts: 1, putToWork: 0 });
  });

  // The bars are chat only on both sides. A workflow artifact still counts toward
  // the headline tile, which is exactly why the bars' `made` column does not sum
  // to it — the footer is what explains that gap on the view.
  it('keeps workflow artifacts out of the category bars but in the headline count', async () => {
    mockDependencies({
      artifacts: [
        artifact('art-1', ALICE, { kind: 'chat', useCase: 'engineering' }),
        artifact('art-2', ALICE, { kind: 'workflow', useCase: null }),
      ],
      egress: putToWork('art-1', 'art-2'),
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);
    const barMade = summary.byUseCase.reduce((total, entry) => total + entry.artifacts, 0);

    expect(summary.artifacts.value).toBe(2);
    expect(barMade).toBe(1);
  });

  it('subtotals each remainder line separately', async () => {
    mockDependencies({
      spendFacts: [
        spend(ALICE, 4.6661, { bucket: 'platform' }),
        spend(ALICE, 0.1696, { bucket: 'unattributed' }),
        spend(BOB, 0.0123, { bucket: 'customAgent' }),
        spend(BOB, 0.5, { bucket: 'workflow' }),
      ],
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(summary.remainder).toEqual({
      platform: 4.6661,
      unattributed: 0.1696,
      customAgent: 0.0123,
      workflow: 0.5,
    });
    expect(summary.chatCost).toBe(0);
  });

  // The invariant the whole footer exists to hold. A panel whose parts do not sum
  // to its own total invites exactly the discrepancy that derails the meeting it
  // surfaces in.
  it('reconciles: the bars sum to chatCost, and chatCost plus the remainder sums to totalCost', async () => {
    mockDependencies({
      spendFacts: [
        spend(ALICE, 2, { useCase: 'proposalCapture' }),
        spend(BOB, 1, { useCase: 'engineering' }),
        spend(BOB, 0.5, { useCase: 'trialTest' }),
        spend(ALICE, 8, { bucket: 'platform' }),
        spend(ALICE, 0.25, { bucket: 'unattributed' }),
        spend(BOB, 0.125, { bucket: 'customAgent' }),
        spend(BOB, 0.0625, { bucket: 'workflow' }),
      ],
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    const barTotal = summary.byUseCase.reduce((total, entry) => total + entry.cost, 0);
    const remainderTotal = summary.remainder.platform
      + summary.remainder.workflow
      + summary.remainder.customAgent
      + summary.remainder.unattributed;

    expect(barTotal).toBeCloseTo(summary.chatCost, 10);
    expect(summary.chatCost + remainderTotal).toBeCloseTo(summary.totalCost, 10);
    expect(summary.chatCost).toBeCloseTo(3.5, 10);
  });

  // System spend is the platform talking to itself, including the very call that
  // categorizes these chats. It is reported so the panel reconciles against the
  // Cost tab, and it is in no total here — if it leaked into totalCost, the
  // classifier would inflate the panel it populates.
  it('reports system spend separately and counts it in no total', async () => {
    mockDependencies({
      spendFacts: [
        spend(ALICE, 3, { useCase: 'proposalCapture' }),
        spend(ALICE, 100, { bucket: 'system' }),
      ],
    });

    const summary = await getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS);

    expect(summary.systemCost).toBe(100);
    expect(summary.totalCost).toBe(3);
    expect(summary.byTeam.reduce((total, team) => total + team.cost, 0)).toBe(3);
  });

  it('throws a sanitized error when a dependency fails', async () => {
    mockDependencies();
    (getSpendFacts as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch spend facts'));

    await expect(
      getValueSummary(TimeRange.Month, 'all', 'all', true, ALL_GROUPS),
    ).rejects.toThrow('Failed to fetch the Context Studio value summary');
  });
});
