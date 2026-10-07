import db from '@/server/db';
import logger from '@/server/logger';
import getOriginPrompt from './getOriginPrompt';
import { OriginPrompt } from '@/features/chat/types/originPrompt';

jest.mock('@/server/db', () => ({
  prompt: {
    findUnique: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getOriginPrompt', () => {
  const mockPromptId = 'cc982788-2d80-49c6-add2-814e3adfc5d8';
  const mockPrompt: OriginPrompt = {
    id: mockPromptId,
    creatorId: 'creator-123',
    title: 'Sample Title',
    description: 'Sample Description',
    instructions: 'Sample Instructions',
    example: 'Sample Example',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches an origin prompt successfully', async () => {
    (db.prompt.findUnique as jest.Mock).mockResolvedValue(mockPrompt);

    const result = await getOriginPrompt(mockPromptId);

    expect(db.prompt.findUnique).toHaveBeenCalledWith({
      where: { id: mockPromptId },
    });

    expect(result).toEqual(mockPrompt);
  });

  it('logs an error and throws an exception if the origin prompt is not found', async () => {
    (db.prompt.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getOriginPrompt(mockPromptId)).rejects.toThrow('The origin prompt no longer exists');

    expect(logger.error).toHaveBeenCalledWith('Origin prompt not found in database');
  });

  it('logs an error and throws an exception if a database error occurs', async () => {
    const mockError = new Error('Database error');
    (db.prompt.findUnique as jest.Mock).mockRejectedValue(mockError);

    await expect(getOriginPrompt(mockPromptId)).rejects.toThrow('Error getting origin prompt');

    expect(logger.error).toHaveBeenCalledWith(
      `Error getting origin prompt: PromptId: ${mockPromptId}`, mockError
    );
  });
});
