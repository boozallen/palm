import getCitedArtifact from '@/features/chat/dal/getCitedArtifact';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  chatArtifact: {
    findFirst: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const findArtifact = db.chatArtifact.findFirst as jest.Mock;

describe('getCitedArtifact', () => {
  const artifact = {
    id: '40000000-0000-0000-0000-000000000004',
    label: 'Decision log',
    fileExtension: '.docx',
    content: 'Artifact content',
    sourceScript: null,
    githubUrl: null,
    githubPagesUrl: null,
    createdAt: new Date('2026-08-29T12:00:00.000Z'),
    chatMessageId: '30000000-0000-0000-0000-000000000003',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches only the requested artifact owned by the user', async () => {
    findArtifact.mockResolvedValue(artifact);

    await expect(getCitedArtifact({
      userId: '10000000-0000-0000-0000-000000000001',
      artifactId: artifact.id,
    })).resolves.toEqual(artifact);

    expect(findArtifact).toHaveBeenCalledWith({
      // Keep the ownership predicate in this query: a foreign id must be
      // indistinguishable from a missing id to the caller.
      where: {
        id: artifact.id,
        message: {
          chat: {
            userId: '10000000-0000-0000-0000-000000000001',
          },
        },
      },
      select: {
        id: true,
        label: true,
        fileExtension: true,
        content: true,
        sourceScript: true,
        githubUrl: true,
        githubPagesUrl: true,
        createdAt: true,
        chatMessageId: true,
      },
    });
    expect(findArtifact.mock.calls[0][0].select).not.toHaveProperty('binaryContent');
  });

  it('passes through null for a missing or foreign artifact', async () => {
    findArtifact.mockResolvedValue(null);

    await expect(getCitedArtifact({
      userId: '10000000-0000-0000-0000-000000000001',
      artifactId: artifact.id,
    })).resolves.toBeNull();
  });

  it('logs database failures and throws a sanitized error', async () => {
    const error = new Error('private database details');
    findArtifact.mockRejectedValue(error);

    await expect(getCitedArtifact({
      userId: '10000000-0000-0000-0000-000000000001',
      artifactId: artifact.id,
    })).rejects.toThrow('Error fetching artifact');
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching cited artifact',
      {
        userId: '10000000-0000-0000-0000-000000000001',
        artifactId: artifact.id,
        error,
      },
    );
  });
});
