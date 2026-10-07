import db from '@/server/db';
import logger from '@/server/logger';
import softDeleteSharedDocument, { SoftDeleteSharedDocumentInput } from './softDeleteSharedDocument';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

jest.mock('@/server/db', () => ({
  sharedDocument: {
    updateMany: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors', () => ({
  handlePrismaError: jest.fn(),
}));

describe('softDeleteSharedDocument dal', () => {
  const mockSourceDocumentId = 'doc-123';
  const mockSourceUserId = 'user-123';
  const mockInput: SoftDeleteSharedDocumentInput = {
    sourceDocumentId: mockSourceDocumentId,
    sourceUserId: mockSourceUserId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soft deletes shared documents successfully', async () => {
    const mockUpdateResult = { count: 2 };
    (db.sharedDocument.updateMany as jest.Mock).mockResolvedValue(mockUpdateResult);

    await softDeleteSharedDocument(mockInput);

    expect(db.sharedDocument.updateMany).toHaveBeenCalledWith({
      where: {
        sourceDocumentId: mockSourceDocumentId,
        sourceUserId: mockSourceUserId,
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
  });

  it('handles case when no shared documents exist to soft delete', async () => {
    const mockUpdateResult = { count: 0 };
    (db.sharedDocument.updateMany as jest.Mock).mockResolvedValue(mockUpdateResult);

    await expect(softDeleteSharedDocument(mockInput)).resolves.toBeUndefined();

    expect(db.sharedDocument.updateMany).toHaveBeenCalledWith({
      where: {
        sourceDocumentId: mockSourceDocumentId,
        sourceUserId: mockSourceUserId,
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
  });

  it('logs error and throws exception when database operation fails', async () => {
    const mockError = new Error('Database connection failed');
    const mockHandledError = 'Error soft deleting shared document';
    (db.sharedDocument.updateMany as jest.Mock).mockRejectedValue(mockError);
    (handlePrismaError as jest.Mock).mockReturnValue(mockHandledError);

    await expect(softDeleteSharedDocument(mockInput)).rejects.toThrow(mockHandledError);

    expect(logger.error).toHaveBeenCalledWith('Failed to soft delete shared document', {
      error: mockError.message,
      sourceDocumentId: mockSourceDocumentId,
      sourceUserId: mockSourceUserId,
    });

    expect(handlePrismaError).toHaveBeenCalledWith(mockError);
  });

  it('handles non-Error exceptions gracefully', async () => {
    const mockError = 'String error';
    const mockHandledError = 'Error soft deleting shared document';
    (db.sharedDocument.updateMany as jest.Mock).mockRejectedValue(mockError);
    (handlePrismaError as jest.Mock).mockReturnValue(mockHandledError);

    await expect(softDeleteSharedDocument(mockInput)).rejects.toThrow(mockHandledError);

    expect(logger.error).toHaveBeenCalledWith('Failed to soft delete shared document', {
      error: 'String error',
      sourceDocumentId: mockSourceDocumentId,
      sourceUserId: mockSourceUserId,
    });
  });
});