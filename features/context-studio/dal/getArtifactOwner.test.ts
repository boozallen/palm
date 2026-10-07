import db from '@/server/db';
import logger from '@/server/logger';
import getArtifactOwner from './getArtifactOwner';

jest.mock('@/server/db', () => ({
  chatArtifact: {
    findUnique: jest.fn(),
  },
  workflowArtifact: {
    findUnique: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('getArtifactOwner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the chat artifact\'s owning user via message -> chat -> userId', async () => {
    (db.chatArtifact.findUnique as jest.Mock).mockResolvedValue({
      message: { chat: { userId: 'user-1' } },
    });

    const result = await getArtifactOwner('chat', 'chat-artifact-1');

    expect(result).toBe('user-1');
    expect(db.chatArtifact.findUnique).toHaveBeenCalledWith({
      where: { id: 'chat-artifact-1' },
      select: { message: { select: { chat: { select: { userId: true } } } } },
    });
  });

  it('returns null when the chat artifact does not exist', async () => {
    (db.chatArtifact.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getArtifactOwner('chat', 'missing-id');

    expect(result).toBeNull();
  });

  it('returns the workflow artifact\'s triggering user', async () => {
    (db.workflowArtifact.findUnique as jest.Mock).mockResolvedValue({
      workflowExecution: { triggeredBy: 'user-2' },
    });

    const result = await getArtifactOwner('workflow', 'workflow-artifact-1');

    expect(result).toBe('user-2');
    expect(db.workflowArtifact.findUnique).toHaveBeenCalledWith({
      where: { id: 'workflow-artifact-1' },
      select: { workflowExecution: { select: { triggeredBy: true } } },
    });
  });

  it('returns null when the workflow artifact does not exist', async () => {
    (db.workflowArtifact.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getArtifactOwner('workflow', 'missing-id');

    expect(result).toBeNull();
  });

  it('throws and logs on failure', async () => {
    const error = new Error('DB error');
    (db.chatArtifact.findUnique as jest.Mock).mockRejectedValue(error);

    await expect(getArtifactOwner('chat', 'chat-artifact-1')).rejects.toThrow('Unable to resolve artifact owner');

    expect(logger.error).toHaveBeenCalledWith('Failed to resolve artifact owner', error);
  });
});
