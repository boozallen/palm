import getDocuments from './getDocuments';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/server/db', () => ({
  document: {
    findMany: jest.fn(),
  },
}));

describe('getDocuments DAL', () => {
  const userId = 'e254b1cd-7a7d-4315-984d-2ba7175b9657';
  const documentUploadProviderId = 'abcde-12345-abcde-12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns list of Document records', async () => {
    const now = new Date();
    const mockResults = [
      {
        id: 'doc1',
        filename: 'file1.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        userId,
      },
      {
        id: 'doc2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Pending,
        userId,
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getDocuments({ userId, documentUploadProviderId });

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: { userId, documentUploadProviderId },
    });
    expect(result).toEqual(mockResults);
  });

  it('logs and throws an error if fetching fails', async () => {
    const error = new Error('db error');
    (db.document.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getDocuments({ userId, documentUploadProviderId })).rejects.toThrow('Error getting documents');
    expect(logger.error).toHaveBeenCalledWith('Error getting documents', error);
  });
});
