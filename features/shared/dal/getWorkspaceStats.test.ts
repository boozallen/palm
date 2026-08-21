import getWorkspaceStats from './getWorkspaceStats';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  document: { count: jest.fn() },
  chat: { count: jest.fn() },
  chatArtifact: { count: jest.fn() },
  chatMessageCitation: { count: jest.fn() },
}));

describe('getWorkspaceStats DAL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated workspace stats', async () => {
    (db.chat.count as jest.Mock).mockResolvedValue(15);
    (db.document.count as jest.Mock).mockResolvedValue(8);
    (db.chatArtifact.count as jest.Mock).mockResolvedValue(6);
    (db.chatMessageCitation.count as jest.Mock).mockResolvedValue(24);

    const result = await getWorkspaceStats();

    expect(result).toEqual({
      chatsLast30Days: 15,
      documentsUploadedLast30Days: 8,
      artifactsGeneratedLast30Days: 6,
      citationsGeneratedLast30Days: 24,
    });
  });

  it('counts only records from the last 30 days for activity metrics', async () => {
    (db.chat.count as jest.Mock).mockResolvedValue(0);
    (db.document.count as jest.Mock).mockResolvedValue(0);
    (db.chatArtifact.count as jest.Mock).mockResolvedValue(0);
    (db.chatMessageCitation.count as jest.Mock).mockResolvedValue(0);

    await getWorkspaceStats();

    const documentArgs = (db.document.count as jest.Mock).mock.calls[0][0];
    expect(documentArgs.where.createdAt.gte).toBeInstanceOf(Date);

    const artifactArgs = (db.chatArtifact.count as jest.Mock).mock.calls[0][0];
    expect(artifactArgs.where.createdAt.gte).toBeInstanceOf(Date);

    const citationArgs = (db.chatMessageCitation.count as jest.Mock).mock.calls[0][0];
    expect(citationArgs.where.message.createdAt.gte).toBeInstanceOf(Date);
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.chat.count as jest.Mock).mockRejectedValue(new Error('db exploded'));

    await expect(getWorkspaceStats()).rejects.toThrow('Error getting workspace stats');
  });
});
