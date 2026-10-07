import deleteAgentProvider from './deleteAgentProvider';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  agentProvider: {
    update: jest.fn(),
  },
}));

describe('deleteAgentProvider', () => {
  const mockId = 'test-id-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soft-deletes an agent provider by setting deletedAt', async () => {
    (db.agentProvider.update as jest.Mock).mockResolvedValue(undefined);

    await deleteAgentProvider(mockId);

    expect(db.agentProvider.update).toHaveBeenCalledWith({
      where: { id: mockId },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('throws and logs when the db call fails', async () => {
    const dbError = new Error('DB connection failed');
    (db.agentProvider.update as jest.Mock).mockRejectedValue(dbError);

    await expect(deleteAgentProvider(mockId)).rejects.toThrow('Error deleting agent provider');

    expect(logger.error).toHaveBeenCalledWith('Error deleting agent provider', dbError);
  });
});
