import db from '@/server/db';
import logger from '@/server/logger';
import getArtifactContent from './getArtifactContent';

jest.mock('@/server/db', () => ({
  chatArtifact: {
    findUnique: jest.fn(),
  },
  workflowArtifact: {
    findUnique: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('getArtifactContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when the chat artifact does not exist', async () => {
    (db.chatArtifact.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getArtifactContent('chat', 'missing-id');

    expect(result).toBeNull();
  });

  it('should return null when the workflow artifact does not exist', async () => {
    (db.workflowArtifact.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getArtifactContent('workflow', 'missing-id');

    expect(result).toBeNull();
  });

  it('should return text content for a chat artifact with no binary content', async () => {
    (db.chatArtifact.findUnique as jest.Mock).mockResolvedValue({
      label: 'Report',
      fileExtension: '.md',
      content: '# Report',
      binaryContent: null,
    });

    const result = await getArtifactContent('chat', 'chat-artifact-1');

    expect(result).toEqual({
      label: 'Report',
      fileExtension: '.md',
      content: '# Report',
      binaryContent: null,
    });
  });

  it('should base64-encode binary content and omit the text content for a chat artifact', async () => {
    (db.chatArtifact.findUnique as jest.Mock).mockResolvedValue({
      label: 'Report',
      fileExtension: '.pdf',
      content: null,
      binaryContent: Buffer.from('binary-bytes'),
    });

    const result = await getArtifactContent('chat', 'chat-artifact-1');

    expect(result).toEqual({
      label: 'Report',
      fileExtension: '.pdf',
      content: null,
      binaryContent: Buffer.from('binary-bytes').toString('base64'),
    });
  });

  it('should return text content for a workflow artifact, which is never binary', async () => {
    (db.workflowArtifact.findUnique as jest.Mock).mockResolvedValue({
      label: 'Summary',
      fileExtension: '.docx',
      content: '# Summary',
    });

    const result = await getArtifactContent('workflow', 'workflow-artifact-1');

    expect(result).toEqual({
      label: 'Summary',
      fileExtension: '.docx',
      content: '# Summary',
      binaryContent: null,
    });
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.chatArtifact.findUnique as jest.Mock).mockRejectedValue(error);

    await expect(getArtifactContent('chat', 'chat-artifact-1')).rejects.toThrow('Unable to fetch artifact content');

    expect(logger.error).toHaveBeenCalledWith('Failed to fetch artifact content', error);
  });
});
