import demoteAdminDocument from './demoteAdminDocument';
import logger from '@/server/logger';

describe('demoteAdminDocument DAL', () => {
  const documentId = 'doc-123';

  const buildTx = () => ({
    adminDocumentGroup: {
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    document: {
      update: jest.fn().mockResolvedValue({ id: documentId, adminCreated: false }),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('demotes an admin document using the provided transaction client', async () => {
    const tx = buildTx();

    await demoteAdminDocument(documentId, tx as never);

    expect(tx.adminDocumentGroup.deleteMany).toHaveBeenCalledWith({ where: { documentId } });
    expect(tx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: {
        adminCreated: false,
        accessUsers: { set: [] },
      },
    });
  });

  it('demotes a document with no groups assigned', async () => {
    const tx = buildTx();
    tx.adminDocumentGroup.deleteMany.mockResolvedValue({ count: 0 });

    await demoteAdminDocument(documentId, tx as never);

    expect(tx.adminDocumentGroup.deleteMany).toHaveBeenCalledWith({ where: { documentId } });
    expect(tx.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: {
        adminCreated: false,
        accessUsers: { set: [] },
      },
    });
  });

  it('logs and throws a sanitized error if demotion fails', async () => {
    const error = new Error('db error');
    const tx = {
      adminDocumentGroup: {
        deleteMany: jest.fn().mockRejectedValue(error),
      },
      document: {
        update: jest.fn(),
      },
    };

    await expect(demoteAdminDocument(documentId, tx as never)).rejects.toThrow('Error removing data source');
    expect(logger.error).toHaveBeenCalledWith(`Error demoting admin document: DocumentId: ${documentId}`, error);
  });
});
