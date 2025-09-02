import db from '@/server/db';
import deleteAiProviderModel from '@/features/settings/dal/ai-providers/deleteAiProviderModel';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockModel = jest.fn();
const mockChats = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    model: { update: mockModel },
    chat: { updateMany: mockChats },
  });
});

describe('deleteAiProviderModel', () => {
  it('should delete AI model successfully', async () => {
    const modelId = '1';

    mockChats.mockResolvedValue({});
    mockModel.mockResolvedValue({ id: modelId });

    const result = await deleteAiProviderModel(modelId);

    expect(result).toEqual({ id: modelId });
  });

  it('should throw an error if delete fails', async () => {
    const modelId = '1';

    const error = new Error('Error deleting the AI provider model');
    mockModel.mockRejectedValueOnce(error);

    await expect(deleteAiProviderModel(modelId)).rejects.toThrow(
      'Error deleting the AI provider model'
    );
  });
});
