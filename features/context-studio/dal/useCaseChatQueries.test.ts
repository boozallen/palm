import {
  buildUsageAdminFilter,
  queryUseCaseArtifacts,
  queryUseCaseChats,
} from '@/features/context-studio/dal/useCaseChatQueries';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { USE_CASE_DETAIL_CHAT_LIMIT } from '@/features/context-studio/types/use-case-detail';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';

jest.mock('@/server/db', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));
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

const queryRaw = db.$queryRaw as jest.Mock;

const scope = {
  useCase: UseCase.ResearchAnalysis,
  timeRange: TimeRange.Month,
  userGroupId: 'all',
  userId: 'all',
  excludeAdmins: true,
};

type MockFragment = { strings: string[]; values: unknown[] };

const isFragment = (value: unknown): value is MockFragment =>
  typeof value === 'object' && value !== null && 'strings' in value;

// Flattens the mocked fragment tree into the SQL the query would run, so a test can
// assert on a nested filter rather than the `?` a plain join leaves in its place.
const render = (value: unknown): string => {
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  return typeof value === 'symbol' ? '' : String(value);
};

const lastSql = (): string => {
  const [strings, ...values] = queryRaw.mock.calls[0];
  return render({ strings, values });
};

describe('queryUseCaseChats', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
  });

  it('ranks chats by spend and caps the list at the shared limit', async () => {
    await queryUseCaseChats(scope);

    expect(lastSql()).toContain('ORDER BY cost DESC');
    expect(queryRaw.mock.calls[0]).toContain(USE_CASE_DETAIL_CHAT_LIMIT);
  });

  it('reports the chat owner rather than whoever paid for a message', async () => {
    await queryUseCaseChats(scope);

    expect(lastSql()).toContain('c."userId" AS owner_user_id');
  });

  // The header's cost, weekly trend and total-chat queries all exclude unattributed
  // rows when the caller asks for it, so the per-chat list has to agree with them.
  it('passes excludeUnattributed through to the scope filter', async () => {
    await queryUseCaseChats({ ...scope, excludeUnattributed: true });

    expect(buildUserScopeFilter as jest.Mock).toHaveBeenCalledWith(
      'apu."userId"', scope.userGroupId, scope.userId, 'apu."userGroupId"', true,
    );
  });
});

describe('queryUseCaseArtifacts', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
  });

  // The list is displayed truncated, so oldest-first hid a busy category's most
  // recent work products behind ones it had long since finished with.
  it('returns the newest work products first', async () => {
    await queryUseCaseArtifacts(scope);

    expect(lastSql()).toContain('ORDER BY ca."createdAt" DESC');
  });

  // Callers derive every work-product count from these rows, so a cap here would
  // quietly shrink the drawer's totals along with the list.
  it('returns every row rather than a page of them', async () => {
    await queryUseCaseArtifacts(scope);

    expect(lastSql()).not.toContain('LIMIT');
  });

  // A ChatArtifact has no usage row to filter on, so the admin predicate has to read
  // the chat's owner. Applying the usage-row form here would be a silent no-op.
  it('drops admin rows by the chat owner, not by a usage row', async () => {
    await queryUseCaseArtifacts(scope);

    expect(lastSql()).toContain('c."userId" NOT IN');
    expect(lastSql()).not.toContain('apu."userId" NOT IN');
  });

  it('keeps admin rows when the caller asks for them', async () => {
    await queryUseCaseArtifacts({ ...scope, excludeAdmins: false });

    expect(lastSql()).not.toContain('NOT IN');
  });
});

describe('buildUsageAdminFilter', () => {
  it('filters on the usage row owner for the spend queries', () => {
    const filter = buildUsageAdminFilter(true) as unknown as { strings: string[] };

    expect(filter.strings.join('?')).toContain('apu."userId" NOT IN');
  });
});
