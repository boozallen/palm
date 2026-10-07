import assignAdminDocumentGroups from './assignAdminDocumentGroups';
import logger from '@/server/logger';

jest.mock('@/server/db');

describe('assignAdminDocumentGroups DAL', () => {
  const documentId = 'doc-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assigns groups and syncs access users successfully', async () => {
    const userGroupIds = ['group-1', 'group-2', 'group-3'];
    const mockMemberships = [
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-1' }, // duplicate
      { userId: 'user-3' },
    ];

    const mockTx = {
      adminDocumentGroup: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      userGroup: {
        findMany: jest.fn().mockResolvedValue(userGroupIds.map(id => ({ id }))),
      },
      userGroupMembership: {
        findMany: jest.fn().mockResolvedValue(mockMemberships),
      },
      document: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    await assignAdminDocumentGroups({ documentId, userGroupIds, tx: mockTx as any });

    expect(mockTx.adminDocumentGroup.deleteMany).toHaveBeenCalledWith({
      where: { documentId },
    });
    expect(mockTx.userGroup.findMany).toHaveBeenCalledWith({
      where: { id: { in: userGroupIds }, deletedAt: null },
      select: { id: true },
    });
    expect(mockTx.adminDocumentGroup.createMany).toHaveBeenCalledWith({
      data: [
        { documentId, userGroupId: 'group-1' },
        { documentId, userGroupId: 'group-2' },
        { documentId, userGroupId: 'group-3' },
      ],
    });
    expect(mockTx.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: { userGroupId: { in: userGroupIds } },
      select: { userId: true },
    });
    expect(mockTx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: {
        accessUsers: {
          set: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
        },
      },
    });
  });

  it('clears all groups when empty array is provided', async () => {
    const userGroupIds: string[] = [];

    const mockTx = {
      adminDocumentGroup: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        createMany: jest.fn(),
      },
      userGroup: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userGroupMembership: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      document: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    await assignAdminDocumentGroups({ documentId, userGroupIds, tx: mockTx as any });

    expect(mockTx.adminDocumentGroup.deleteMany).toHaveBeenCalledWith({
      where: { documentId },
    });
    expect(mockTx.adminDocumentGroup.createMany).not.toHaveBeenCalled();
    expect(mockTx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: {
        accessUsers: {
          set: [],
        },
      },
    });
  });

  it('handles single group assignment', async () => {
    const userGroupIds = ['group-1'];
    const mockMemberships = [{ userId: 'user-1' }, { userId: 'user-2' }];

    const mockTx = {
      adminDocumentGroup: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userGroup: {
        findMany: jest.fn().mockResolvedValue([{ id: 'group-1' }]),
      },
      userGroupMembership: {
        findMany: jest.fn().mockResolvedValue(mockMemberships),
      },
      document: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    await assignAdminDocumentGroups({ documentId, userGroupIds, tx: mockTx as any });

    expect(mockTx.adminDocumentGroup.createMany).toHaveBeenCalledWith({
      data: [{ documentId, userGroupId: 'group-1' }],
    });
    expect(mockTx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: {
        accessUsers: {
          set: [{ id: 'user-1' }, { id: 'user-2' }],
        },
      },
    });
  });

  it('drops a soft-deleted group id instead of granting access to it', async () => {
    const userGroupIds = ['group-1', 'group-deleted'];
    const mockMemberships = [{ userId: 'user-1' }];

    const mockTx = {
      adminDocumentGroup: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // group-deleted has a real row (FK-satisfying) but no deletedAt: null match,
      // so it never comes back here.
      userGroup: {
        findMany: jest.fn().mockResolvedValue([{ id: 'group-1' }]),
      },
      userGroupMembership: {
        findMany: jest.fn().mockResolvedValue(mockMemberships),
      },
      document: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    await assignAdminDocumentGroups({ documentId, userGroupIds, tx: mockTx as any });

    expect(mockTx.adminDocumentGroup.createMany).toHaveBeenCalledWith({
      data: [{ documentId, userGroupId: 'group-1' }],
    });
    expect(mockTx.userGroupMembership.findMany).toHaveBeenCalledWith({
      where: { userGroupId: { in: ['group-1'] } },
      select: { userId: true },
    });
  });

  it('logs and throws an error if assignment fails', async () => {
    const userGroupIds = ['group-1'];
    const error = new Error('db error');

    const mockTx = {
      adminDocumentGroup: {
        deleteMany: jest.fn().mockRejectedValue(error),
      },
    };

    await expect(assignAdminDocumentGroups({ documentId, userGroupIds, tx: mockTx as any })).rejects.toThrow(
      'Error assigning admin document groups'
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error assigning admin document groups: DocumentId: ${documentId}`,
      error
    );
  });
});
