import logger from '@/server/logger';
import getUserHasKnowledgeBaseAccess from './getUserHasKnowledgeBaseAccess';
import db from '@/server/db';

jest.mock('@/server/db', () => {
  return {
    knowledgeBase: {
      findUnique: jest.fn(),
    },
  };
});

describe('getUserHasKnowledgeBaseAccess', () => {

  const mockKnowledgeBaseId = '3ee7718a-3673-4c98-9ac1-b588586665d9';
  const mockUserId = '7435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockError = new Error('Extremely sensitive information');

  const mockResolvedValue = {
    id: mockKnowledgeBaseId,
    label: 'Mock Knowledge Base',
    externalId: 'mock-knowledge-base',
    kbProviderId: 'b2da0eb2-58fe-4fd5-bec5-0b39eb747bae',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (db.knowledgeBase.findUnique as jest.Mock).mockResolvedValue(mockResolvedValue);
  });

  it('returns true if user has access to knowledge base', async () => {
    const res = await getUserHasKnowledgeBaseAccess(mockKnowledgeBaseId, mockUserId);

    expect(res).toBe(true);
    expect(db.knowledgeBase.findUnique).toHaveBeenCalledTimes(1);
    expect(db.knowledgeBase.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockKnowledgeBaseId,
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
    });
  });

  it('returns false if user does not have access to knowledge base', async () => {
    (db.knowledgeBase.findUnique as jest.Mock).mockResolvedValue(null);

    const randomUuid = '5dade469-a1fe-47ef-972d-e5035913457e';
    const res = await getUserHasKnowledgeBaseAccess(randomUuid, mockUserId);

    expect(res).toBe(false);
  });

  it('throws error if db operation fails', async () => {
    (db.knowledgeBase.findUnique as jest.Mock).mockRejectedValue(mockError);

    await expect(
      getUserHasKnowledgeBaseAccess(mockKnowledgeBaseId, mockUserId)
    ).rejects.toThrow(new Error('Error fetching user knowledge bases'));

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching user knowledge bases',
      mockError
    );
  });
});
