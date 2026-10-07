import db from '@/server/db';
import logger from '@/server/logger';
import getErrorRecords from './getErrorRecords';

jest.mock('@/server/db', () => ({
  errorRecord: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

const query = {
  source: undefined,
  code: undefined,
  search: undefined,
  page: 1,
  pageSize: 20,
};

const record = (metadata: unknown) => ({
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  source: 'trpc',
  route: 'settings.getUsersListWithRole',
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Something went wrong',
  stack: 'Error: Something went wrong\n    at handler',
  timestamp: new Date('2026-07-27T00:00:00.000Z'),
  user: { name: 'Test User', email: 'test@example.com' },
  metadata,
});

describe('getErrorRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.errorRecord.count as jest.Mock).mockResolvedValue(1);
  });

  it('maps a record to its result shape, including the resolved user', async () => {
    (db.errorRecord.findMany as jest.Mock).mockResolvedValueOnce([record({ type: 'query' })]);

    const result = await getErrorRecords(query);

    expect(result.records[0]).toMatchObject({
      id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
      userName: 'Test User',
      userEmail: 'test@example.com',
      source: 'trpc',
      route: 'settings.getUsersListWithRole',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
      metadata: { type: 'query' },
    });
    expect(result.totalCount).toBe(1);
  });

  it('falls back to null user fields for unauthenticated/system errors', async () => {
    (db.errorRecord.findMany as jest.Mock).mockResolvedValueOnce([
      { ...record(null), user: null },
    ]);

    const result = await getErrorRecords(query);

    expect(result.records[0].userName).toBeNull();
    expect(result.records[0].userEmail).toBeNull();
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.errorRecord.findMany as jest.Mock).mockRejectedValueOnce(new Error('connection refused'));

    await expect(getErrorRecords(query)).rejects.toThrow('Unable to retrieve error records');
    expect(logger.error).toHaveBeenCalled();
  });
});
