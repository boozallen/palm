import db from '@/server/db';
import logger from '@/server/logger';
import createDocument from './createDocument';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/server/db', () => ({
  document: {
    create: jest.fn(),
  },
}));

describe('createDocument dal', () => {
  const mockUserId = 'user-123';
  const mockFilename = 'test.pdf';
  const mockDocumentUploadProviderId = 'test-123-456-abcd';
  const mockInput = {
    userId: mockUserId,
    filename: mockFilename,
    documentUploadProviderId: mockDocumentUploadProviderId,
  };

  const mockResult = {
    id: 'doc-456',
    userId: mockUserId,
    filename: mockFilename,
    uploadStatus: DocumentUploadStatus.Pending,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new PersonalDocument successfully', async () => {
    (db.document.create as jest.Mock).mockResolvedValue(mockResult);

    const result = await createDocument(mockInput);

    expect(db.document.create).toHaveBeenCalledWith({
      data: {
        userId: mockUserId,
        filename: mockFilename,
        uploadStatus: DocumentUploadStatus.Pending,
        documentUploadProviderId: mockDocumentUploadProviderId,
      },
    });

    expect(result).toEqual({
      id: mockResult.id,
      userId: mockResult.userId,
      filename: mockResult.filename,
      uploadStatus: mockResult.uploadStatus,
      createdAt: mockResult.createdAt,
    });
  });

  it('logs an error and throws an exception if an error occurs', async () => {
    const mockError = new Error('DB error');
    (db.document.create as jest.Mock).mockRejectedValue(mockError);

    await expect(createDocument(mockInput)).rejects.toThrow('Error creating document');
    expect(logger.error).toHaveBeenCalledWith(
      `Error creating document: UserId: ${mockUserId}`,
      mockError
    );
  });
});
