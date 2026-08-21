import db from '@/server/db';
import deleteGitHubProvider from './deleteGitHubProvider';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  gitHubProvider: {
    update: jest.fn(),
  },
}));

describe('deleteGitHubProvider', () => {
  const providerId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soft deletes GitHub provider successfully', async () => {
    (db.gitHubProvider.update as jest.Mock).mockResolvedValue({});

    await deleteGitHubProvider(providerId);

    expect(db.gitHubProvider.update).toHaveBeenCalledWith({
      where: { id: providerId },
      data: {
        userGroups: { set: [] },
        deletedAt: expect.any(Date),
      },
    });
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error deleting GitHub provider');
    (db.gitHubProvider.update as jest.Mock).mockRejectedValue(error);

    await expect(deleteGitHubProvider(providerId)).rejects.toThrow(
      'Error deleting GitHub provider',
    );

    expect(logger.error).toHaveBeenCalledWith('Error deleting GitHub provider', expect.objectContaining({ error }));
  });
});
