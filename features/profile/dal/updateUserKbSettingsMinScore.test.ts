import updateUserKbSettingsMinScore from './updateUserKbSettingsMinScore';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  user: {
    update: jest.fn(),
  },
}));

describe('updateUserKbSettingsMinScore DAL', () => {
  const mockUserId = '7435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockMinScore = 0.5;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates the user kb min score', async () => {
    const mockResponse = { knowledgeBasesMinScore: mockMinScore };
    (db.user.update as jest.Mock).mockResolvedValue(mockResponse);

    const result = await updateUserKbSettingsMinScore(mockUserId, mockMinScore);

    expect(result).toEqual(mockResponse);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { knowledgeBasesMinScore: mockMinScore },
    });
  });

  it('handles null value correctly', async () => {
    const mockResponse = { knowledgeBasesMinScore: null };
    (db.user.update as jest.Mock).mockResolvedValue(mockResponse);

    const result = await updateUserKbSettingsMinScore(mockUserId, null);

    expect(result).toEqual(mockResponse);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { knowledgeBasesMinScore: null },
    });
  });

  it('throws an error if the update fails', async () => {
    (db.user.update as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(updateUserKbSettingsMinScore(mockUserId, mockMinScore))
      .rejects.toThrow('Error updating knowledge bases min score');
  });
});
