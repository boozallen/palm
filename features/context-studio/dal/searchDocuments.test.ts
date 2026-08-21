import db from '@/server/db';
import logger from '@/server/logger';
import searchDocuments from './searchDocuments';

jest.mock('@/server/db', () => ({
  document: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('searchDocuments', () => {
  const mockDocument = {
    id: 'doc-1',
    filename: 'report.pdf',
    createdAt: new Date('2026-06-01'),
    userId: 'user-1',
    dataProfile: { type: 'pdf', summary: 'A quarterly report' },
    user: { name: 'Test User', email: 'test@example.com' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.document.findMany as jest.Mock).mockResolvedValue([mockDocument]);
    (db.document.count as jest.Mock).mockResolvedValue(1);
  });

  it('should return paginated document results', async () => {
    const result = await searchDocuments({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.records[0].id).toBe('doc-1');
    expect(result.records[0].filename).toBe('report.pdf');
    expect(result.records[0].userName).toBe('Test User');
    expect(result.records[0].type).toBe('pdf');
    expect(result.records[0].summary).toBe('A quarterly report');
  });

  it('should apply filename search filter', async () => {
    await searchDocuments({ search: 'report', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          filename: { contains: 'report', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should filter by documentType using JSONB path', async () => {
    await searchDocuments({ documentType: 'pdf', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dataProfile: { path: ['type'], equals: 'pdf' },
        }),
      }),
    );
  });

  it('should apply date range filters', async () => {
    await searchDocuments({ startDate: '2026-01-01', endDate: '2026-06-30', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: new Date('2026-01-01'),
            lt: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('should filter by userId', async () => {
    await searchDocuments({ userId: 'user-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
        }),
      }),
    );
  });

  it('should filter by userGroupId', async () => {
    await searchDocuments({ userGroupId: 'group-123', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            userGroupMemberhip: { some: { userGroupId: 'group-123' } },
          }),
        }),
      }),
    );
  });

  it('should not apply userId filter when value is all', async () => {
    await searchDocuments({ userId: 'all', page: 1, pageSize: 20, excludeAdmins: false });

    const call = (db.document.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.userId).toBeUndefined();
  });

  it('should exclude admins when flag is set', async () => {
    await searchDocuments({ page: 1, pageSize: 20, excludeAdmins: true });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            role: { not: 'Admin' },
          }),
        }),
      }),
    );
  });

  it('should apply timeRange filter for week', async () => {
    await searchDocuments({ timeRange: 'week', page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('should not apply timeRange filter for forever', async () => {
    await searchDocuments({ timeRange: 'forever', page: 1, pageSize: 20, excludeAdmins: false });

    const call = (db.document.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.createdAt).toBeUndefined();
  });

  it('should handle null dataProfile', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([
      { ...mockDocument, dataProfile: null },
    ]);

    const result = await searchDocuments({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(result.records[0].type).toBeNull();
    expect(result.records[0].summary).toBeNull();
  });

  it('should handle pagination correctly', async () => {
    await searchDocuments({ page: 3, pageSize: 5, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
      }),
    );
  });

  it('should order by createdAt desc', async () => {
    await searchDocuments({ page: 1, pageSize: 20, excludeAdmins: false });

    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.document.findMany as jest.Mock).mockRejectedValue(error);

    await expect(searchDocuments({ page: 1, pageSize: 20, excludeAdmins: false }))
      .rejects.toThrow('Unable to search documents');

    expect(logger.error).toHaveBeenCalledWith('Failed to search documents', error);
  });
});
