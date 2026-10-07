import logger from '@/server/logger';
import deleteDocument from './deleteDocument';
import db from '@/server/db';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@/features/graph-database/dal/deleteGraphNodes', () => jest.fn());

describe('deleteDocument', () => {
  const mockDocumentId = 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e';
  const mockPrisma = {
    document: {
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.$transaction as jest.Mock).mockImplementation((callback) => callback(mockPrisma));
    (deleteGraphNodes as jest.Mock).mockResolvedValue(undefined);
  });

  it('should delete a document successfully', async () => {
    const deletionResult = { id: mockDocumentId };
    mockPrisma.document.delete.mockResolvedValue(deletionResult);

    const result = await deleteDocument(mockDocumentId);

    expect(result).toEqual({ id: mockDocumentId });
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: mockDocumentId } });
    expect(deleteGraphNodes).toHaveBeenCalledWith(mockDocumentId);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when deleting from database', async () => {
    const error = new Error('Database error');
    mockPrisma.document.delete.mockRejectedValue(error);

    await expect(deleteDocument(mockDocumentId)).rejects.toThrow('Error deleting document');
    expect(logger.error).toHaveBeenCalledWith(`Error deleting document from the database. Id: ${mockDocumentId}`, error);
  });

  it('should succeed even if graph deletion fails', async () => {
    const deletionResult = { id: mockDocumentId };
    mockPrisma.document.delete.mockResolvedValue(deletionResult);

    const graphError = new Error('Graph deletion failed');
    (deleteGraphNodes as jest.Mock).mockRejectedValue(graphError);

    const result = await deleteDocument(mockDocumentId);

    expect(result).toEqual({ id: mockDocumentId });
    expect(logger.error).toHaveBeenCalledWith(`Document ${mockDocumentId} deleted from DB, but graph node deletion failed:`, graphError);
  });
});
