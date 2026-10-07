import updateWorkflowArtifactGithubPagesUrl from './updateWorkflowArtifactGithubPagesUrl';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  workflowArtifact: {
    update: jest.fn(),
  },
}));

const mockDb = db.workflowArtifact as jest.Mocked<typeof db.workflowArtifact>;

describe('updateWorkflowArtifactGithubPagesUrl', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates githubPagesUrl on the artifact', async () => {
    const artifactId = 'artifact-uuid-1';
    const githubPagesUrl = 'https://myorg.github.io/my-repo/artifacts/abc123/my-presentation.html';

    mockDb.update.mockResolvedValueOnce({} as any);

    await updateWorkflowArtifactGithubPagesUrl(artifactId, githubPagesUrl);

    expect(mockDb.update).toHaveBeenCalledWith({
      where: { id: artifactId },
      data: { githubPagesUrl },
    });
  });

  it('logs and throws when the db update fails', async () => {
    const artifactId = 'artifact-uuid-1';
    const githubPagesUrl = 'https://myorg.github.io/my-repo/artifacts/abc123/my-presentation.html';
    const error = new Error('DB error');

    mockDb.update.mockRejectedValueOnce(error);

    await expect(
      updateWorkflowArtifactGithubPagesUrl(artifactId, githubPagesUrl)
    ).rejects.toThrow('Error updating artifact GitHub Pages URL');

    expect(logger.error).toHaveBeenCalledWith(
      `Error updating githubPagesUrl for workflow artifact: ${artifactId}`,
      error,
    );
  });
});
