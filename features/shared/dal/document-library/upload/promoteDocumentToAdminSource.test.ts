import promoteDocumentToAdminSource from './promoteDocumentToAdminSource';
import logger from '@/server/logger';
import assignAdminDocumentGroups from './assignAdminDocumentGroups';

jest.mock('./assignAdminDocumentGroups');

describe('promoteDocumentToAdminSource DAL', () => {
  const documentId = 'doc-123';
  const userGroupIds = ['group-1', 'group-2'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('promotes a document to admin source successfully', async () => {
    const mockTx = {
      document: {
        update: jest.fn().mockResolvedValue({
          id: documentId,
          adminCreated: true,
        }),
      },
    };
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);

    await promoteDocumentToAdminSource({ documentId, userGroupIds, tx: mockTx as any });

    expect(mockTx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: { adminCreated: true },
    });
    expect(assignAdminDocumentGroups).toHaveBeenCalledWith({
      documentId,
      userGroupIds,
      tx: mockTx,
    });
  });

  it('promotes document with single group', async () => {
    const singleGroupIds = ['group-1'];
    const mockTx = {
      document: {
        update: jest.fn().mockResolvedValue({
          id: documentId,
          adminCreated: true,
        }),
      },
    };
    (assignAdminDocumentGroups as jest.Mock).mockResolvedValue(undefined);

    await promoteDocumentToAdminSource({ documentId, userGroupIds: singleGroupIds, tx: mockTx as any });

    expect(mockTx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: { adminCreated: true },
    });
    expect(assignAdminDocumentGroups).toHaveBeenCalledWith({
      documentId,
      userGroupIds: singleGroupIds,
      tx: mockTx,
    });
  });

  it('logs and throws an error if update fails', async () => {
    const error = new Error('db error');
    const mockTx = {
      document: {
        update: jest.fn().mockRejectedValue(error),
      },
    };

    await expect(promoteDocumentToAdminSource({ documentId, userGroupIds, tx: mockTx as any })).rejects.toThrow(
      'Error promoting document to admin source'
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error promoting document to admin source: DocumentId: ${documentId}`,
      error
    );
    expect(assignAdminDocumentGroups).not.toHaveBeenCalled();
  });

  it('logs and throws an error if group assignment fails', async () => {
    const error = new Error('assignment error');
    const mockTx = {
      document: {
        update: jest.fn().mockResolvedValue({
          id: documentId,
          adminCreated: true,
        }),
      },
    };
    (assignAdminDocumentGroups as jest.Mock).mockRejectedValue(error);

    await expect(promoteDocumentToAdminSource({ documentId, userGroupIds, tx: mockTx as any })).rejects.toThrow(
      'Error promoting document to admin source'
    );
    expect(mockTx.document.update).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Error promoting document to admin source: DocumentId: ${documentId}`,
      error
    );
  });
});
