import db from '@/server/db';
import logger from '@/server/logger';
import getArtifactSizes from './getArtifactSizes';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

describe('getArtifactSizes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return an empty map without querying when both id lists are empty', async () => {
    const result = await getArtifactSizes([], []);

    expect(result.size).toBe(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('should query only chat artifacts when workflowArtifactIds is empty', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ id: 'chat-artifact-1', size: 1024 }]);

    const result = await getArtifactSizes(['chat-artifact-1'], []);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.get('chat-artifact-1')).toBe(1024);
  });

  it('should query only workflow artifacts when chatArtifactIds is empty', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ id: 'workflow-artifact-1', size: 2048 }]);

    const result = await getArtifactSizes([], ['workflow-artifact-1']);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.get('workflow-artifact-1')).toBe(2048);
  });

  it('should merge sizes from both sources into one map, keyed by artifact id', async () => {
    (db.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ id: 'chat-artifact-1', size: BigInt(1024) }])
      .mockResolvedValueOnce([{ id: 'workflow-artifact-1', size: BigInt(2048) }]);

    const result = await getArtifactSizes(['chat-artifact-1'], ['workflow-artifact-1']);

    expect(result.get('chat-artifact-1')).toBe(1024);
    expect(result.get('workflow-artifact-1')).toBe(2048);
  });

  it('should default a null size to 0', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([{ id: 'chat-artifact-1', size: null }]);

    const result = await getArtifactSizes(['chat-artifact-1'], []);

    expect(result.get('chat-artifact-1')).toBe(0);
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.$queryRaw as jest.Mock).mockRejectedValue(error);

    await expect(getArtifactSizes(['chat-artifact-1'], [])).rejects.toThrow('Unable to fetch artifact sizes');

    expect(logger.error).toHaveBeenCalledWith('Failed to fetch artifact sizes', error);
  });
});
