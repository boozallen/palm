import buildChatVisitDurations from '@/features/context-studio/dal/chatVisitDurations';
import db from '@/server/db';

jest.mock('@/server/db', () => ({ __esModule: true, default: { $queryRaw: jest.fn() } }));
jest.mock('@/server/logger');

// The real Prisma runtime resolves to its browser build under jest and throws
// on Prisma.sql/Prisma.join — same workaround as searchChats.test.ts.
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    raw: jest.fn((value: string) => value),
    join: jest.fn((arr: unknown[]) => arr),
    empty: Symbol('empty'),
  },
}));

const queryRaw = db.$queryRaw as jest.Mock;

describe('buildChatVisitDurations', () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('returns an empty map without querying when no chats are given', async () => {
    const result = await buildChatVisitDurations([], ['user-1']);

    expect(result.size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns total time and each visit for a chat', async () => {
    queryRaw.mockResolvedValue([{
      chatId: 'chat-1',
      totalDurationMs: BigInt(90000),
      visits: [{ enteredAt: '2026-09-01T10:00:00Z', leftAt: '2026-09-01T10:01:30Z', durationMs: 90000 }],
    }]);

    const result = await buildChatVisitDurations(['chat-1'], ['user-1']);

    expect(result.get('chat-1')?.totalDurationMs).toBe(90000);
    expect(result.get('chat-1')?.visits).toHaveLength(1);
    expect(result.get('chat-1')?.visits[0].enteredAt).toEqual(new Date('2026-09-01T10:00:00Z'));
  });
});
