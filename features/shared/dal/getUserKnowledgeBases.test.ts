import getUserKnowledgeBases from './getUserKnowledgeBases';
import db from '@/server/db';
import { UserKnowledgeBase } from '@/features/shared/types/knowledge-base';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    knowledgeBase: {
      findMany: jest.fn(),
    },
  };
});
describe('getUserKnowledgeBasesDal', () => {
  const userId = 'f6201669-0bef-4411-b264-cd39cfbc62df';

  const mockedResolvedValue: UserKnowledgeBase[] = [];
  const mockRejectedValue = new Error('Unable to fetch knowledge bases at this time. Please try again later');

  beforeEach(() => {
    jest.clearAllMocks();

    (db.knowledgeBase.findMany as jest.Mock).mockResolvedValue(mockedResolvedValue);
  });

  it('returns knowledge bases based on user groups', async () => {

    await getUserKnowledgeBases(userId);

    expect(db.knowledgeBase.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        kbProvider: {
          userGroups: {
            some: {
              userGroupMemberships: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
      include: {
        kbProvider: {
          select: {
            label: true,
          },
        },
      },
    });
  });

  it('throws an error if the DB query fails', async () => {
    (db.knowledgeBase.findMany as jest.Mock).mockRejectedValue(mockRejectedValue);

    await expect(getUserKnowledgeBases(userId)).rejects.toThrow(new Error('Error fetching user knowledge bases'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching user knowledge bases', mockRejectedValue
    );
  });
});
