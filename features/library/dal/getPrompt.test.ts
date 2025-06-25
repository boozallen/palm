import db from '@/server/db';
import getPrompt from '@/features/library/dal/getPrompt';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  prompt: {
    findUnique: jest.fn(),
  },
}));

describe('getPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get a prompt successfully', async () => {
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
    const dbPrompt = { id: promptId };
    (db.prompt.findUnique as jest.Mock).mockResolvedValue(dbPrompt);

    const result = await getPrompt(promptId);

    expect(result).toEqual({
      config: {},
      id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
      tags: [],
    });
    expect(db.prompt.findUnique).toHaveBeenCalledWith({
      where: { id: promptId },
      include: { tags: true },
    });
  });

  it('should handle errors when getting a prompt', async () => {
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
    const error = new Error('Database error');
    (db.prompt.findUnique as jest.Mock).mockRejectedValue(error);

    await expect(getPrompt(promptId)).rejects.toThrow('Error getting prompt');
    expect(logger.error).toHaveBeenCalled();
  });
});
