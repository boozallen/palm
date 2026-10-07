import isChatInUseCaseScope from '@/features/context-studio/dal/isChatInUseCaseScope';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { buildUseCaseSqlFilter } from '@/features/context-studio/services/useCaseTaxonomy';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';

jest.mock('@/server/db', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
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
}));
jest.mock('@/features/context-studio/dal/userScopeFilter', () => ({
  buildUserScopeFilter: jest.fn(() => ({ sql: 'mocked' })),
}));

const queryRaw = db.$queryRaw as jest.Mock;

const CHAT_ID = '11111111-1111-1111-1111-111111111111';
const GROUP_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

const check = (userId = USER_ID, excludeAdmins = true) =>
  isChatInUseCaseScope(CHAT_ID, UseCase.ProposalCapture, TimeRange.Month, GROUP_ID, userId, excludeAdmins);

describe('isChatInUseCaseScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a chat the filters select', async () => {
    queryRaw.mockResolvedValue([{ in_scope: 1 }]);

    await expect(check()).resolves.toBe(true);
  });

  it('refuses a chat the filters do not select', async () => {
    queryRaw.mockResolvedValue([]);

    await expect(check()).resolves.toBe(false);
  });

  // The whole point of the check: a viewer restricted to their own id must not be
  // able to open someone else's chat by passing its id.
  it('scopes the lookup by the user it was given', async () => {
    queryRaw.mockResolvedValue([]);

    await check();

    expect(buildUserScopeFilter).toHaveBeenCalledWith(
      'apu."userId"',
      GROUP_ID,
      USER_ID,
      'apu."userGroupId"',
      true,
    );
  });

  it('constrains the lookup to the requested category', async () => {
    queryRaw.mockResolvedValue([]);

    await check();

    expect(buildUseCaseSqlFilter).toHaveBeenCalledWith(UseCase.ProposalCapture);
  });

  it('binds the chat id as a uuid rather than interpolating it', async () => {
    queryRaw.mockResolvedValue([]);

    await check();

    const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');

    expect(sql).toContain('c.id = ?::uuid');
    expect(queryRaw.mock.calls[0]).toContain(CHAT_ID);
  });

  it('stops at the first matching row', async () => {
    queryRaw.mockResolvedValue([]);

    await check();

    expect((queryRaw.mock.calls[0][0] as string[]).join('?')).toContain('LIMIT 1');
  });

  it('reports a failed check as an error rather than as a denial', async () => {
    queryRaw.mockRejectedValue(new Error('boom'));

    await expect(check()).rejects.toThrow('Failed to verify chat access');
  });
});
