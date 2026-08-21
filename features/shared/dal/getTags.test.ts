import db from '@/server/db';
import logger from '@/server/logger';
import getTags from '@/features/shared/dal/getTags';

jest.mock('@/server/db', () => ({
  promptTag: {
    findMany: jest.fn(),
  },
}));

describe('getTags', () => {
  const mockResolveValue = [
    {
      tag: 'tag1',
    },
    {
      tag: 'tag2',
    },
    {
      tag: 'someOtherValue',
    },
  ];

  const mockReturnValue = ['tag1', 'tag2', 'someOtherValue'];
  const mockFilteredReturnValue = ['tag1', 'tag2', 'someOtherValue'];

  const mockError = new Error('Error fetching tags');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all records found in the DB', async () => {
    (db.promptTag.findMany as jest.Mock).mockResolvedValue(mockResolveValue);

    await expect(getTags()).resolves.toEqual(mockReturnValue);
    expect(db.promptTag.findMany).toHaveBeenCalledWith({
      distinct: ['tag'],
      select: { tag: true },
      where: { tag: { contains: undefined, mode: 'insensitive' } },
      orderBy: { tag: 'asc' },
      take: 10,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns filtered records when a query is provided', async () => {
    (db.promptTag.findMany as jest.Mock).mockResolvedValue(mockResolveValue);

    const query = 'tag';
    await expect(getTags(query)).resolves.toEqual(mockFilteredReturnValue);
    expect(db.promptTag.findMany).toHaveBeenCalledWith({
      distinct: ['tag'],
      select: { tag: true },
      where: { tag: { contains: query, mode: 'insensitive' } },
      orderBy: { tag: 'asc' },
      take: 10,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error when the DB query fails', async () => {
    (db.promptTag.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getTags()).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith('Error fetching tags', mockError);
  });

  it('limits the number of records returned to 10', async () => {
    (db.promptTag.findMany as jest.Mock).mockResolvedValue(mockResolveValue);

    await getTags();
    expect(db.promptTag.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 10,
    }));
  });

  it('orders the records by tag in ascending order', async () => {
    (db.promptTag.findMany as jest.Mock).mockResolvedValue(mockResolveValue);

    await getTags();
    expect(db.promptTag.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { tag: 'asc' },
    }));
  });
});
