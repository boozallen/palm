import getAllDocumentsForAdmin from './getAllDocumentsForAdmin';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/server/db', () => ({
  document: {
    findMany: jest.fn(),
  },
}));

describe('getAllDocumentsForAdmin DAL', () => {
  const documentUploadProviderId = 'provider-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all documents with user and group information', async () => {
    const now = new Date();
    const mockResults = [
      {
        id: 'doc1',
        userId: 'user-1',
        filename: 'file1.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        adminDocumentGroups: [
          {
            userGroup: {
              id: 'group-1',
              label: 'Engineering',
            },
          },
          {
            userGroup: {
              id: 'group-2',
              label: 'Product',
            },
          },
        ],
      },
      {
        id: 'doc2',
        userId: 'user-2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Pending,
        adminCreated: false,
        user: {
          name: 'Jane Smith',
          email: null,
        },
        adminDocumentGroups: [],
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getAllDocumentsForAdmin({ documentUploadProviderId });

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: {
        documentUploadProviderId,
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        adminCreated: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        adminDocumentGroups: {
          select: {
            userGroup: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([
      {
        id: 'doc1',
        userId: 'user-1',
        filename: 'file1.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        userName: 'John Doe',
        userEmail: 'john@example.com',
        assignedGroupIds: ['group-1', 'group-2'],
        assignedGroupLabels: ['Engineering', 'Product'],
      },
      {
        id: 'doc2',
        userId: 'user-2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Pending,
        adminCreated: false,
        userName: 'Jane Smith',
        userEmail: undefined,
        assignedGroupIds: [],
        assignedGroupLabels: [],
      },
    ]);
  });

  it('returns empty array when no documents exist', async () => {
    (db.document.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getAllDocumentsForAdmin({ documentUploadProviderId });

    expect(result).toEqual([]);
  });

  it('logs and throws an error if fetching fails', async () => {
    const error = new Error('db error');
    (db.document.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getAllDocumentsForAdmin({ documentUploadProviderId })).rejects.toThrow(
      'Error getting all documents for admin'
    );
    expect(logger.error).toHaveBeenCalledWith('Error getting all documents for admin', error);
  });
});
