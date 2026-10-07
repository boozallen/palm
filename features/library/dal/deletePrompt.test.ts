import logger from '@/server/logger';
import deletePrompt from './deletePrompt';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  prompt: {
    delete: jest.fn(),
  },
}));

describe('deletePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a prompt successfully', async () => {
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
    const deletionResult = { id: promptId };
    (db.prompt.delete as jest.Mock).mockResolvedValue(deletionResult);

    const result = await deletePrompt(promptId);

    expect(result).toEqual({ id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c' });
    expect(db.prompt.delete).toHaveBeenCalledWith({ where: { id: promptId } });
  });

  it('should handle errors when deleting a prompt', async () => {
    const promptId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
    const error = new Error('Database error');
    (db.prompt.delete as jest.Mock).mockRejectedValue(error);

    await expect(deletePrompt(promptId)).rejects.toThrow('Error deleting prompt');
    expect(logger.error).toHaveBeenCalled();
  });
});
