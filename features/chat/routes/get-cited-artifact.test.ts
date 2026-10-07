import getCitedArtifact from '@/features/chat/dal/getCitedArtifact';
import chatRouter from '@/features/chat/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/chat/dal/getCitedArtifact');

const mockGetCitedArtifact = getCitedArtifact as jest.MockedFunction<typeof getCitedArtifact>;

describe('chat.getCitedArtifact', () => {
  const userId = '10000000-0000-0000-0000-000000000001';
  const artifactId = '40000000-0000-0000-0000-000000000004';
  const artifact = {
    id: artifactId,
    label: 'Decision log',
    fileExtension: '.docx',
    content: 'Artifact content',
    sourceScript: null,
    githubUrl: null,
    githubPagesUrl: null,
    createdAt: new Date('2026-08-29T12:00:00.000Z'),
    chatMessageId: '30000000-0000-0000-0000-000000000003',
  };
  const ctx = { userId } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an owned cited artifact', async () => {
    mockGetCitedArtifact.mockResolvedValue(artifact);

    const result = await chatRouter.createCaller(ctx).getCitedArtifact({ artifactId });

    expect(result).toEqual(artifact);
    expect(mockGetCitedArtifact).toHaveBeenCalledWith({ userId, artifactId });
  });

  it('throws NotFound when the artifact is missing or belongs to another user', async () => {
    mockGetCitedArtifact.mockResolvedValue(null);

    await expect(
      chatRouter.createCaller(ctx).getCitedArtifact({ artifactId }),
    ).rejects.toThrow('Artifact not found');
  });

  it('uses the authenticated user id instead of an input-supplied value', async () => {
    mockGetCitedArtifact.mockResolvedValue(artifact);

    await chatRouter.createCaller(ctx).getCitedArtifact({
      artifactId,
      userId: '20000000-0000-0000-0000-000000000002',
    } as { artifactId: string });

    expect(mockGetCitedArtifact).toHaveBeenCalledWith({ userId, artifactId });
  });
});
