import logger from '@/server/logger';
import deleteDocument from './deleteDocument';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  document: {
    delete: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe('deleteDocument', () => {
  const mockDocumentId = 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a document successfully', async () => {
    const deletionResult = { id: mockDocumentId };
    (db.document.delete as jest.Mock).mockResolvedValue(deletionResult);

    const result = await deleteDocument(mockDocumentId);

    expect(result).toEqual({ id: mockDocumentId });
    expect(db.document.delete).toHaveBeenCalledWith({ where: { id: mockDocumentId } });
  });

  it('should handle errors when deleting from database', async () => {
    const error = new Error('Database error');
    (db.document.delete as jest.Mock).mockRejectedValue(error);

    await expect(deleteDocument(mockDocumentId)).rejects.toThrow('Error deleting document');
    expect(logger.error).toHaveBeenCalledWith(`Error deleting document from the database. Id: ${mockDocumentId}`, error);
  });
});
