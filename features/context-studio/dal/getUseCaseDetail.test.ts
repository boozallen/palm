import getUseCaseDetail from '@/features/context-studio/dal/getUseCaseDetail';
import getArtifactEgress from '@/features/context-studio/dal/getArtifactEgress';
import { chatBucketExpression } from '@/features/context-studio/dal/getSpendFacts';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';

jest.mock('@/server/db', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
// The egress lookup is mocked, but not the shared predicate that reads its result —
// the whole point of sharing it is that every caller applies the same rule.
jest.mock('@/features/context-studio/dal/getArtifactEgress', () => ({
  __esModule: true,
  default: jest.fn(),
  isPutToWork: jest.requireActual('@/features/context-studio/dal/getArtifactEgress').isPutToWork,
}));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    raw: jest.fn((value: string) => value),
    join: jest.fn((arr: unknown[]) => arr),
    empty: Symbol('empty'),
  },
}));
jest.mock('@/server/logger');
jest.mock('@/features/context-studio/dal/getSpendFacts', () => ({
  chatBucketExpression: jest.fn(() => ({ sql: 'mocked' })),
}));
jest.mock('@/features/context-studio/services/useCaseTaxonomy', () => ({
  buildUseCaseSqlFilter: jest.fn(() => ({ sql: 'mocked' })),
}));
jest.mock('@/features/context-studio/dal/timeRangeFilter', () => ({
  buildTimeRangeFilter: jest.fn(() => ({ sql: 'mocked' })),
  buildSinceWindowFilter: jest.fn(() => ({ sql: 'mocked' })),
}));
jest.mock('@/features/context-studio/dal/userScopeFilter', () => ({
  buildUserScopeFilter: jest.fn(() => ({ sql: 'mocked' })),
}));
jest.mock('@/features/context-studio/dal/getValueSummary', () => ({
  UNATTRIBUTED_TEAM_LABEL: 'Unattributed (no team)',
}));

const queryRaw = db.$queryRaw as jest.Mock;
const egress = getArtifactEgress as jest.Mock;
const bucketExpr = chatBucketExpression as jest.Mock;

const chatRows = [
  { chat_id: 'chat-1', title: 'Competitor Landscape', owner_user_id: 'user-1', owner_name: 'Dana', owner_email: 'dana@x.test', cost: 38, created_at: new Date('2026-09-01') },
  { chat_id: 'chat-2', title: 'FedRAMP Boundary Options', owner_user_id: 'user-2', owner_name: 'Marcus', owner_email: 'marcus@x.test', cost: 31, created_at: new Date('2026-09-02') },
];
// Only carries attributed rows: the spend query itself excludes unattributed usage,
// so user-2's unattributed activity below shows up only via the artifact-only fallback.
const spendRows = [
  { user_id: 'user-1', user_name: 'Dana', user_email: 'dana@x.test', user_group_id: 'group-1', group_label: 'Growth & Capture', chats: BigInt(1), cost: 38 },
];
const weeklyRows = [
  { week_start: new Date('2026-08-31'), category_cost: 69, chat_cost: 690 },
];
const artifactRows = [
  { artifact_id: 'art-1', name: 'competitor-matrix.xlsx', chat_id: 'chat-1', owner_user_id: 'user-1', user_group_id: 'group-1', group_label: 'Growth & Capture' },
  { artifact_id: 'art-2', name: 'boundary-options.md', chat_id: 'chat-2', owner_user_id: 'user-2', user_group_id: null, group_label: null },
];

function mockQueries() {
  queryRaw
    .mockResolvedValueOnce(chatRows)
    .mockResolvedValueOnce(spendRows)
    .mockResolvedValueOnce(weeklyRows)
    .mockResolvedValueOnce(artifactRows)
    .mockResolvedValueOnce([{ total: BigInt(2) }]);
}

describe('getUseCaseDetail', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    egress.mockReset();
    egress.mockResolvedValue(new Map([['art-1', { downloaded: true, copied: false, published: false }]]));
    (buildUserScopeFilter as jest.Mock).mockClear();
  });

  it('returns one row per chat with its spend, work products and minutes', async () => {
    mockQueries();

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(detail.chats).toHaveLength(2);
    expect(detail.chats[0]).toMatchObject({ chatId: 'chat-1', cost: 38, artifacts: 1, putToWork: 1 });
    expect(detail.chats[1]).toMatchObject({ chatId: 'chat-2', artifacts: 1, putToWork: 0 });
  });

  it('totals spend, work products and put-to-work across the category', async () => {
    mockQueries();

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(detail.cost).toBe(38);
    expect(detail.artifacts).toBe(2);
    expect(detail.putToWork).toBe(1);
    expect(detail.totalChats).toBe(2);
  });

  it('excludes unattributed rows from the chat list, spend, trend and total queries', async () => {
    mockQueries();

    await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    const excludeUnattributedCalls = (buildUserScopeFilter as jest.Mock).mock.calls.filter(
      (call) => call[4] === true,
    );
    // Chat list, spend, weekly trend and total-chat queries all exclude unattributed
    // rows so the drawer's per-chat costs agree with the header; the artifact list
    // query does not, so unattributed work products still show.
    expect(excludeUnattributedCalls).toHaveLength(4);
  });

  it('names a chat with no group attribution as unattributed in the teams block', async () => {
    mockQueries();

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(detail.teams.map((team) => team.label)).toContain('Unattributed (no team)');
  });

  it('reports the weekly share against all chat spend in that week', async () => {
    mockQueries();

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(detail.weekly[0].shareOfChatSpend).toBeCloseTo(0.1);
  });

  it('marks which put-to-work signals fired for each work product', async () => {
    mockQueries();

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(detail.artifactList[0]).toMatchObject({ name: 'competitor-matrix.xlsx', signals: ['downloaded'] });
    expect(detail.artifactList[1].signals).toEqual([]);
  });

  // The displayed list is truncated, but every count comes from the full set of rows,
  // so the two must not be derived from the same trimmed array.
  it('counts every work product it was given, not just the ones shown', async () => {
    mockQueries();

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(detail.artifacts).toBe(artifactRows.length);
    expect(detail.artifactList).toHaveLength(artifactRows.length);
  });

  it('selects chat spend under the shared bucket expression', async () => {
    mockQueries();

    await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    expect(bucketExpr).toHaveBeenCalled();
  });

  it('shows team label when team has artifacts but no spend', async () => {
    const artifactsOnlyRows = [
      { artifact_id: 'art-3', name: 'doc.pdf', chat_id: 'chat-3', owner_user_id: 'user-3', user_group_id: 'group-2', group_label: 'Engineering' },
    ];
    queryRaw
      .mockResolvedValueOnce(chatRows)
      .mockResolvedValueOnce(spendRows)
      .mockResolvedValueOnce(weeklyRows)
      .mockResolvedValueOnce(artifactsOnlyRows)
      .mockResolvedValueOnce([{ total: BigInt(2) }]);

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    const engineeringTeam = detail.teams.find((team) => team.userGroupId === 'group-2');
    expect(engineeringTeam).toBeDefined();
    expect(engineeringTeam?.label).toBe('Engineering');
    expect(engineeringTeam?.artifacts).toBe(1);
    expect(engineeringTeam?.cost).toBe(0);
  });

  // The header sums every spend row, so a person who worked under two groups has to
  // add up to the same figure or the block cannot be reconciled against it.
  it('sums a person who worked under more than one team into one row', async () => {
    const multiGroupSpendRows = [
      { user_id: 'user-1', user_name: 'Dana', user_email: 'dana@x.test', user_group_id: 'group-1', group_label: 'Growth & Capture', chats: BigInt(1), cost: 38 },
      { user_id: 'user-1', user_name: 'Dana', user_email: 'dana@x.test', user_group_id: 'group-2', group_label: 'Engineering', chats: BigInt(2), cost: 12 },
    ];
    queryRaw
      .mockResolvedValueOnce(chatRows)
      .mockResolvedValueOnce(multiGroupSpendRows)
      .mockResolvedValueOnce(weeklyRows)
      .mockResolvedValueOnce(artifactRows)
      .mockResolvedValueOnce([{ total: BigInt(2) }]);

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    const dana = detail.people.filter((person) => person.userId === 'user-1');
    expect(dana).toHaveLength(1);
    expect(dana[0]).toMatchObject({ chats: 3, cost: 50, artifacts: 1, putToWork: 1 });
    expect(detail.people.reduce((sum, person) => sum + person.cost, 0)).toBe(detail.cost);
  });

  it('lists a person with work products but no spend at zero cost', async () => {
    const artifactsOnlyRows = [
      { artifact_id: 'art-3', name: 'brief.docx', chat_id: 'chat-3', owner_user_id: 'user-9', user_group_id: 'group-1', group_label: 'Growth & Capture' },
    ];
    queryRaw
      .mockResolvedValueOnce(chatRows)
      .mockResolvedValueOnce(spendRows)
      .mockResolvedValueOnce(weeklyRows)
      .mockResolvedValueOnce(artifactsOnlyRows)
      .mockResolvedValueOnce([{ total: BigInt(2) }]);

    const detail = await getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all');

    const producer = detail.people.find((person) => person.userId === 'user-9');
    expect(producer).toMatchObject({ cost: 0, chats: 0, artifacts: 1, name: null, email: null });
  });

  it('throws a sanitized error when a query fails', async () => {
    queryRaw.mockRejectedValue(new Error('connection lost'));

    await expect(getUseCaseDetail(UseCase.ResearchAnalysis, TimeRange.Month, 'all', 'all'))
      .rejects.toThrow('Failed to fetch use case detail');
  });
});
