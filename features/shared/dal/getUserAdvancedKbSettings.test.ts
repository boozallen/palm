import getUserAdvancedKbSettings from '@/features/shared/dal/getUserAdvancedKbSettings';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe('getUserAdvancedKbSettings DAL', () => {

  const mockUserId = '7435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockUserAdvancedKbSettings = {
    knowledgeBasesMinScore: 0.5,
    knowledgeBasesMaxResults: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the user advanced kb settings by userId', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUserAdvancedKbSettings);

    const response = await getUserAdvancedKbSettings(mockUserId);
    expect(response).toEqual(mockUserAdvancedKbSettings);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockUserId,
      },
      select: {
        knowledgeBasesMinScore: true,
        knowledgeBasesMaxResults: true,
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error if the user is not found', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getUserAdvancedKbSettings(mockUserId)).rejects.toThrow('Error getting user advanced knowledge base settings');
  });

  it('throws an error if the database operation fails', async () => {
    const dbError = new Error('Database connection failed');
    (db.user.findUnique as jest.Mock).mockRejectedValue(dbError);

    await expect(getUserAdvancedKbSettings(mockUserId)).rejects.toThrow('Error getting user advanced knowledge base settings');
  });

});
