import getUserPreselectedKnowledgeBases from './getUserPreselectedKnowledgeBases';
import logger from '@/server/logger';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe('getUserPreselectedKnowledgeBases DAL', () => {
  const mockResolve = {
    knowledgeBases: [
      { id: '230a46ee-ab0a-4267-8a39-acd7625a4864' },
      { id: '24b9af27-87fb-4093-b35b-105c42956bc2' },
      { id: 'a5256f22-4438-42d4-b395-3295d1707e9d' },
    ],
  };
  const mockResponse = {
    userPreselectedKnowledgeBases: [
      { id: '230a46ee-ab0a-4267-8a39-acd7625a4864' },
      { id: '24b9af27-87fb-4093-b35b-105c42956bc2' },
      { id: 'a5256f22-4438-42d4-b395-3295d1707e9d' },
    ],
  };

  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockError = 'Error fetching preselected Knowledge Bases';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retrieves the preselected KnowledgeBases', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockResolve);
    const response = await getUserPreselectedKnowledgeBases(mockUserId);
    expect(response).toEqual(mockResponse);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockUserId,
      },
      select: {
        knowledgeBases: {
          where: {
            deletedAt: null,
            kbProvider: {
              userGroups: {
                some: {
                  userGroupMemberships: {
                    some: {
                      userId: mockUserId,
                    },
                  },
                },
              },
            },
          },
          select: {
            id: true,
          },
        },
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the user is not found', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(getUserPreselectedKnowledgeBases(mockUserId)).rejects.toThrow(
      mockError
    );
    expect(logger.error).toHaveBeenCalledWith(mockError, new Error('User not found'));
  });

  it('returns empty array if user has no preselected knowledge bases', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue({ knowledgeBases: [] });
    const response = await getUserPreselectedKnowledgeBases(mockUserId);
    expect(response).toEqual({ userPreselectedKnowledgeBases: [] });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the operation fails', async () => {
    const rejectError = new Error('Error fetching preselected knowledge bases');
    (db.user.findUnique as jest.Mock).mockRejectedValue(rejectError);
    await expect(getUserPreselectedKnowledgeBases(mockUserId)).rejects.toThrow(
      mockError
    );
    expect(logger.error).toHaveBeenCalledWith(mockError, rejectError);
  });
});
