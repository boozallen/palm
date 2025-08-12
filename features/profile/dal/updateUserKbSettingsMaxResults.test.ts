import updateUserKbSettingsMaxResults from './updateUserKbSettingsMaxResults';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  user: {
    update: jest.fn(),
  },
}));

describe('updateUserKbSettingsMaxResults DAL', () => {
  const mockUserId = '7435b69e-3757-47a2-bacf-d4efdd85a32e';
  const mockMaxResults = 25;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates the user kb max results', async () => {
    const mockResponse = { knowledgeBasesMaxResults: mockMaxResults };
    (db.user.update as jest.Mock).mockResolvedValue(mockResponse);

    const result = await updateUserKbSettingsMaxResults(mockUserId, mockMaxResults);

    expect(result).toEqual(mockResponse);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { knowledgeBasesMaxResults: mockMaxResults },
    });
  });

  it('handles null value correctly', async () => {
    const mockResponse = { knowledgeBasesMaxResults: null };
    (db.user.update as jest.Mock).mockResolvedValue(mockResponse);

    const result = await updateUserKbSettingsMaxResults(mockUserId, null);

    expect(result).toEqual(mockResponse);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { knowledgeBasesMaxResults: null },
    });
  });

  it('throws an error if the update fails', async () => {
    (db.user.update as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(updateUserKbSettingsMaxResults(mockUserId, mockMaxResults))
      .rejects.toThrow('Error updating knowledge bases max results');
  });
});
