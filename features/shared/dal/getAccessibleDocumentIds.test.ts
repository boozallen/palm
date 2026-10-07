import getAccessibleDocumentIds from './getAccessibleDocumentIds';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  document: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe('getAccessibleDocumentIds DAL', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the user\'s personal docs', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'doc-a' },
      { id: 'doc-b' },
    ]);

    const result = await getAccessibleDocumentIds(userId);

    expect(result.has('doc-a')).toBe(true);
    expect(result.has('doc-b')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('returns admin docs assigned to the user via accessUsers', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'personal-doc' },
      { id: 'admin-doc-in-group' },
    ]);

    const result = await getAccessibleDocumentIds(userId);

    expect(result.has('personal-doc')).toBe(true);
    expect(result.has('admin-doc-in-group')).toBe(true);
  });

  it('excludes admin docs the user has no access to', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([
      { id: 'personal-doc' },
    ]);

    const result = await getAccessibleDocumentIds(userId);

    expect(result.has('personal-doc')).toBe(true);
    expect(result.has('admin-doc-not-in-group')).toBe(false);
  });

  it('queries with OR of personal-ownership and admin+accessUsers', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([]);

    await getAccessibleDocumentIds(userId);

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId },
          { adminCreated: true, accessUsers: { some: { id: userId } } },
        ],
      },
      select: { id: true },
    });
  });

  it('returns an empty set when the user has no accessible documents', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getAccessibleDocumentIds(userId);

    expect(result.size).toBe(0);
  });

  it('logs and throws a sanitized error when the DB call fails', async () => {
    const dbError = new Error('connection refused');
    (db.document.findMany as jest.Mock).mockRejectedValue(dbError);

    await expect(getAccessibleDocumentIds(userId)).rejects.toThrow(
      'Error fetching accessible documents',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching accessible document IDs',
      expect.objectContaining({ userId, error: dbError }),
    );
  });
});
