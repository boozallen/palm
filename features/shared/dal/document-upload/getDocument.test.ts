import getDocument from './getDocument';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/server/db', () => ({
  document: {
    findUnique: jest.fn(),
  },
}));

describe('getDocument DAL', () => {
  const documentId = 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a Document record', async () => {
    const mockDocument = {
      id: documentId,
      userId: '97cc1d48-03df-4c18-9456-917c1ac78c77',
      filename: 'file1.pdf',
      createdAt: new Date(),
      uploadStatus: DocumentUploadStatus.Completed,
    };

    (db.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);

    const result = await getDocument(documentId);

    expect(db.document.findUnique).toHaveBeenCalledWith({
      where: { id: documentId },
    });
    expect(result).toEqual(mockDocument);
  });

  it('logs and throws an error if fetching fails', async () => {
    const error = new Error('db error');
    (db.document.findUnique as jest.Mock).mockRejectedValue(error);

    await expect(getDocument(documentId)).rejects.toThrow('Error getting document');
    expect(logger.error).toHaveBeenCalledWith('Error getting document', error);
  });
});
