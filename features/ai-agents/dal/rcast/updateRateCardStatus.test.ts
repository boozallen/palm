import db from '@/server/db';
import updateRateCardStatus from './updateRateCardStatus';

jest.mock('@/server/db', () => ({
  rateCard: {
    update: jest.fn(),
  },
}));

describe('updateRateCardStatus', () => {
  const mockRateCardId = 'rate-card-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (db.rateCard.update as jest.Mock).mockResolvedValue({
      id: mockRateCardId,
      uploadStatus: 'completed',
    });
  });

  it('should update rate card status to completed', async () => {
    await updateRateCardStatus(mockRateCardId, 'completed');

    expect(db.rateCard.update).toHaveBeenCalledWith({
      where: { id: mockRateCardId },
      data: { uploadStatus: 'completed' },
    });
  });

  it('should update rate card status to failed', async () => {
    await updateRateCardStatus(mockRateCardId, 'failed');

    expect(db.rateCard.update).toHaveBeenCalledWith({
      where: { id: mockRateCardId },
      data: { uploadStatus: 'failed' },
    });
  });

  it('should update rate card status to processing', async () => {
    await updateRateCardStatus(mockRateCardId, 'processing');

    expect(db.rateCard.update).toHaveBeenCalledWith({
      where: { id: mockRateCardId },
      data: { uploadStatus: 'processing' },
    });
  });

  it('should update rate card status to pending', async () => {
    await updateRateCardStatus(mockRateCardId, 'pending');

    expect(db.rateCard.update).toHaveBeenCalledWith({
      where: { id: mockRateCardId },
      data: { uploadStatus: 'pending' },
    });
  });

  it('should propagate database errors', async () => {
    const dbError = new Error('Database error');
    (db.rateCard.update as jest.Mock).mockRejectedValue(dbError);

    await expect(updateRateCardStatus(mockRateCardId, 'completed')).rejects.toThrow(
      'Database error'
    );
  });
});
