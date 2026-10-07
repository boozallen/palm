import getChatArtifactVersions from '@/features/chat/dal/getChatArtifactVersions';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatArtifactVersion: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

import db from '@/server/db';

describe('getChatArtifactVersions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns versions ordered oldest to newest', async () => {
    const mockVersions = [
      { id: 'v1', versionNumber: 1, content: '# Original', editedByUserId: null, createdAt: new Date('2024-01-01') },
      { id: 'v2', versionNumber: 2, content: '# Edited', editedByUserId: 'user-1', createdAt: new Date('2024-01-02') },
    ];

    (db.chatArtifactVersion.findMany as jest.Mock).mockResolvedValue(mockVersions);

    const result = await getChatArtifactVersions('artifact-1');

    expect(result).toEqual(mockVersions);
    expect(db.chatArtifactVersion.findMany).toHaveBeenCalledWith({
      where: { chatArtifactId: 'artifact-1' },
      orderBy: { versionNumber: 'asc' },
      select: {
        id: true,
        versionNumber: true,
        content: true,
        editedByUserId: true,
        createdAt: true,
      },
    });
  });

  it('returns an empty array when the artifact has no version history', async () => {
    (db.chatArtifactVersion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getChatArtifactVersions('artifact-1');

    expect(result).toEqual([]);
  });

  it('throws a sanitized error on database failure', async () => {
    (db.chatArtifactVersion.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

    await expect(getChatArtifactVersions('artifact-1')).rejects.toThrow('Error fetching artifact versions');
  });
});
