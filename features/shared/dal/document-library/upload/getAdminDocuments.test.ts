import getAdminDocuments from './getAdminDocuments';
import db from '@/server/db';
import logger from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';
import getDocumentLineage from './getDocumentLineage';

jest.mock('@/server/db', () => ({
  document: {
    findMany: jest.fn(),
  },
  graphMetadata: {
    findFirst: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
}));

jest.mock('./getDocumentLineage');

describe('getAdminDocuments DAL', () => {
  const userId = 'e254b1cd-7a7d-4315-984d-2ba7175b9657';
  const adminUserId = 'admin-user-id-12345';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getDocumentLineage
    (getDocumentLineage as jest.Mock).mockResolvedValue({
      depth: 0,
      chain: [],
    });

    // Default mock for graphMetadata
    (db.graphMetadata.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it('returns all documents when user is admin', async () => {
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
          name: 'User One',
          email: 'user1@example.com',
          userGroupMemberhip: [],
        },
        adminDocumentGroups: [
          {
            userGroupId: 'group-1',
            userGroup: {
              label: 'Group 1',
            },
          },
        ],
        sharedDocuments: [],
        collectionMemberships: [],
      },
      {
        id: 'doc2',
        userId: 'user-2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: false,
        user: {
          name: 'User Two',
          email: 'user2@example.com',
          userGroupMemberhip: [],
        },
        adminDocumentGroups: [],
        sharedDocuments: [],
        collectionMemberships: [],
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getAdminDocuments({ userId: adminUserId, isAdmin: true });

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: {},
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        text: true,
        adminCreated: true,
        user: {
          select: {
            name: true,
            email: true,
            userGroupMemberhip: {
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
        },
        adminDocumentGroups: {
          select: {
            userGroupId: true,
            userGroup: {
              select: {
                label: true,
              },
            },
          },
        },
        sharedDocuments: {
          select: {
            id: true,
            actions: {
              select: {
                status: true,
              },
            },
            sharedWithUserGroupIds: true,
          },
        },
        collectionMemberships: {
          select: {
            collection: {
              select: {
                id: true,
                name: true,
                color: true,
                adminCreated: true,
                userId: true,
                user: { select: { name: true } },
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
        userName: 'User One',
        userEmail: 'user1@example.com',
        assignedGroupIds: ['group-1'],
        assignedGroupLabels: ['Group 1'],
        userGroupMemberships: [],
        lineage: {
          depth: 0,
          chain: [],
        },
        graphJobInfo: undefined,
        shareStatusCounts: {
          pending: 0,
          accepted: 0,
          rejected: 0,
        },
        collections: [],
      },
      {
        id: 'doc2',
        userId: 'user-2',
        filename: 'file2.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: false,
        userName: 'User Two',
        userEmail: 'user2@example.com',
        assignedGroupIds: [],
        assignedGroupLabels: [],
        userGroupMemberships: [],
        lineage: {
          depth: 0,
          chain: [],
        },
        graphJobInfo: undefined,
        shareStatusCounts: {
          pending: 0,
          accepted: 0,
          rejected: 0,
        },
        collections: [],
      },
    ]);
  });

  it('returns only user-owned documents when user is not admin (group lead)', async () => {
    const now = new Date();
    const mockResults = [
      {
        id: 'doc1',
        userId,
        filename: 'my-file.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: false,
        user: {
          name: 'Test User',
          email: 'test@example.com',
          userGroupMemberhip: [],
        },
        adminDocumentGroups: [],
        sharedDocuments: [],
        collectionMemberships: [],
      },
      {
        id: 'doc2',
        userId,
        filename: 'my-admin-file.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        user: {
          name: 'Test User',
          email: 'test@example.com',
          userGroupMemberhip: [],
        },
        adminDocumentGroups: [
          {
            userGroupId: 'group-1',
            userGroup: {
              label: 'Group 1',
            },
          },
        ],
        sharedDocuments: [],
        collectionMemberships: [],
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getAdminDocuments({ userId, isAdmin: false });

    expect(db.document.findMany).toHaveBeenCalledWith({
      where: { userId },
      select: {
        id: true,
        userId: true,
        filename: true,
        createdAt: true,
        uploadStatus: true,
        text: true,
        adminCreated: true,
        user: {
          select: {
            name: true,
            email: true,
            userGroupMemberhip: {
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
        },
        adminDocumentGroups: {
          select: {
            userGroupId: true,
            userGroup: {
              select: {
                label: true,
              },
            },
          },
        },
        sharedDocuments: {
          select: {
            id: true,
            actions: {
              select: {
                status: true,
              },
            },
            sharedWithUserGroupIds: true,
          },
        },
        collectionMemberships: {
          select: {
            collection: {
              select: {
                id: true,
                name: true,
                color: true,
                adminCreated: true,
                userId: true,
                user: { select: { name: true } },
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
        userId,
        filename: 'my-file.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: false,
        userName: 'Test User',
        userEmail: 'test@example.com',
        assignedGroupIds: [],
        assignedGroupLabels: [],
        userGroupMemberships: [],
        lineage: {
          depth: 0,
          chain: [],
        },
        graphJobInfo: undefined,
        shareStatusCounts: {
          pending: 0,
          accepted: 0,
          rejected: 0,
        },
        collections: [],
      },
      {
        id: 'doc2',
        userId,
        filename: 'my-admin-file.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        userName: 'Test User',
        userEmail: 'test@example.com',
        assignedGroupIds: ['group-1'],
        assignedGroupLabels: ['Group 1'],
        userGroupMemberships: [],
        lineage: {
          depth: 0,
          chain: [],
        },
        graphJobInfo: undefined,
        shareStatusCounts: {
          pending: 0,
          accepted: 0,
          rejected: 0,
        },
        collections: [],
      },
    ]);
  });

  it('returns documents with multiple assigned groups', async () => {
    const now = new Date();
    const mockResults = [
      {
        id: 'doc1',
        userId: adminUserId,
        filename: 'multi-group-doc.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        user: {
          name: 'Admin User',
          email: 'admin@example.com',
          userGroupMemberhip: [],
        },
        adminDocumentGroups: [
          {
            userGroupId: 'group-1',
            userGroup: {
              label: 'Group 1',
            },
          },
          {
            userGroupId: 'group-2',
            userGroup: {
              label: 'Group 2',
            },
          },
          {
            userGroupId: 'group-3',
            userGroup: {
              label: 'Group 3',
            },
          },
        ],
        sharedDocuments: [],
        collectionMemberships: [],
      },
    ];
    (db.document.findMany as jest.Mock).mockResolvedValue(mockResults);

    const result = await getAdminDocuments({ userId: adminUserId, isAdmin: true });

    expect(result).toEqual([
      {
        id: 'doc1',
        userId: adminUserId,
        filename: 'multi-group-doc.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        adminCreated: true,
        userName: 'Admin User',
        userEmail: 'admin@example.com',
        assignedGroupIds: ['group-1', 'group-2', 'group-3'],
        assignedGroupLabels: ['Group 1', 'Group 2', 'Group 3'],
        userGroupMemberships: [],
        lineage: {
          depth: 0,
          chain: [],
        },
        graphJobInfo: undefined,
        shareStatusCounts: {
          pending: 0,
          accepted: 0,
          rejected: 0,
        },
        collections: [],
      },
    ]);
  });

  it('logs and throws an error if fetching fails', async () => {
    const error = new Error('db error');
    (db.document.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getAdminDocuments({ userId, isAdmin: true })).rejects.toThrow('Error getting admin documents');
    expect(logger.error).toHaveBeenCalledWith(`Error getting admin documents: UserId: ${userId}`, error);
  });
});
