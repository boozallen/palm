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
        adminCreated: false,
        dataProfile: { type: 'SOO', summary: 'cloud modernization', date: '2026-02-17' },
        adminDocumentGroups: [],
        collectionMemberships: [],
      },
      {
        id: 'doc2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Pending,
        userId,
        adminCreated: false,
        adminDocumentGroups: [],
        collectionMemberships: [],
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getDocuments({ userId, documentUploadProviderId });

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: {
        documentUploadProviderId,
        OR: [
          { userId },
          { adminCreated: true, accessUsers: { some: { id: userId } } },
        ],
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        adminCreated: true,
        dataProfile: true,
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
        collectionMemberships: {
          where: { collection: { OR: [{ userId }, { adminCreated: true }] } },
          select: {
            collection: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });
    expect(result).toEqual([
      {
        id: 'doc1',
        filename: 'file1.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        userId,
        adminCreated: false,
        dataProfile: { type: 'SOO', summary: 'cloud modernization', date: '2026-02-17' },
        assignedGroupIds: [],
        assignedGroupLabels: [],
        collections: [],
      },
      {
        id: 'doc2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Pending,
        userId,
        adminCreated: false,
        assignedGroupIds: [],
        assignedGroupLabels: [],
        collections: [],
      },
    ]);
  });

  it('returns documents with assigned group information', async () => {
    const now = new Date();
    const mockResults = [
      {
        id: 'doc1',
        filename: 'admin-file.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        userId: 'admin-user-id',
        adminCreated: true,
        adminDocumentGroups: [
          {
            userGroup: {
              id: 'group-1',
              label: 'Engineering Team',
            },
          },
          {
            userGroup: {
              id: 'group-2',
              label: 'Product Team',
            },
          },
        ],
        collectionMemberships: [],
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getDocuments({ userId, documentUploadProviderId });

    expect(result).toEqual([
      {
        id: 'doc1',
        filename: 'admin-file.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        userId: 'admin-user-id',
        adminCreated: true,
        assignedGroupIds: ['group-1', 'group-2'],
        assignedGroupLabels: ['Engineering Team', 'Product Team'],
        collections: [],
      },
    ]);
  });

  it('logs and throws an error if fetching fails', async () => {
    const error = new Error('db error');
    (db.document.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getDocuments({ userId, documentUploadProviderId })).rejects.toThrow('Error getting documents');
    expect(logger.error).toHaveBeenCalledWith('Error getting documents', error);
  });
});
