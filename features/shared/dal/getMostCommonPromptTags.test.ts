import db from '@/server/db';
import logger from '@/server/logger';
import getMostCommonPromptTags from '@/features/shared/dal/getMostCommonPromptTags';

jest.mock('@/server/db', () => ({
  promptTag: {
    groupBy: jest.fn(),
  },
}));

describe('getMostCommonPromptTags DAL', () => {

  const mockResolve = [
    { _count: { tag: 5 }, tag: 'tag-1' },
    { _count: { tag: 4 }, tag: 'tag-2' },
    { _count: { tag: 3 }, tag: 'tag-3' },
    { _count: { tag: 2 }, tag: 'tag-4' },
    { _count: { tag: 1 }, tag: 'tag-5' },
  ];
  const mockResponse = mockResolve.map((promptTag) => promptTag.tag);

  const dalErrorMessage = 'Error fetching most common prompt tags';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of the most common prompt tags in descending order', async () => {
    (db.promptTag.groupBy as jest.Mock).mockResolvedValue(mockResolve);

    await expect(getMostCommonPromptTags()).resolves.toEqual(mockResponse);

    expect(db.promptTag.groupBy).toHaveBeenCalledWith({
      by: ['tag'],
      _count: {
        tag: true,
      },
      orderBy: {
        _count: {
          tag: 'desc',
        },
      },
      take: 25,
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the promptTag.groupBy query fails', async () => {
    const mockError = new Error('groupBy query failed');
    (db.promptTag.groupBy as jest.Mock).mockRejectedValue(mockError);

    await expect(getMostCommonPromptTags()).rejects.toThrow(dalErrorMessage);

    expect(logger.error).toHaveBeenCalledWith(dalErrorMessage, mockError);
  });

});
