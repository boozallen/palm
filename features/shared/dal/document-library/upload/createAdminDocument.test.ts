import createAdminDocument from './createAdminDocument';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/server/db', () => ({
  document: {
    create: jest.fn(),
  },
}));

describe('createAdminDocument DAL', () => {
  const userId = 'e254b1cd-7a7d-4315-984d-2ba7175b9657';
  const filename = 'test-document.pdf';
  const documentUploadProviderId = 'provider-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an admin document successfully', async () => {
    const now = new Date();
    const mockDocument = {
      id: 'doc-123',
      userId,
      filename,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      text: null,
      adminCreated: true,
    };
    (db.document.create as jest.Mock).mockResolvedValue(mockDocument);

    const result = await createAdminDocument({
      userId,
      filename,
      documentUploadProviderId,
    });

    expect(db.document.create).toHaveBeenCalledWith({
      data: {
        userId,
        filename,
        uploadStatus: DocumentUploadStatus.Pending,
        documentUploadProviderId,
        adminCreated: true,
      },
    });
    expect(result).toEqual({
      id: 'doc-123',
      userId,
      filename,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      text: undefined,
      adminCreated: true,
    });
  });

  it('creates an admin document with text field', async () => {
    const now = new Date();
    const mockDocument = {
      id: 'doc-456',
      userId,
      filename,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      text: 'Document content',
      adminCreated: true,
    };
    (db.document.create as jest.Mock).mockResolvedValue(mockDocument);

    const result = await createAdminDocument({
      userId,
      filename,
      documentUploadProviderId,
    });

    expect(result).toEqual({
      id: 'doc-456',
      userId,
      filename,
      uploadStatus: DocumentUploadStatus.Pending,
      createdAt: now,
      text: 'Document content',
      adminCreated: true,
    });
  });

  it('logs and throws an error if creation fails', async () => {
    const error = new Error('db error');
    (db.document.create as jest.Mock).mockRejectedValue(error);

    await expect(
      createAdminDocument({
        userId,
        filename,
        documentUploadProviderId,
      })
    ).rejects.toThrow('Error creating admin document');
    expect(logger.error).toHaveBeenCalledWith(`Error creating admin document: UserId: ${userId}`, error);
  });
});
