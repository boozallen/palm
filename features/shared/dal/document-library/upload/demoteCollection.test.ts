import demoteCollection from './demoteCollection';
import demoteAdminDocument from './demoteAdminDocument';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('./demoteAdminDocument');
jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

describe('demoteCollection DAL', () => {
  const collectionId = 'col-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('demotes every admin document in the collection and clears the shared flag', async () => {
    const tx = {
      documentCollectionMembership: {
        findMany: jest.fn().mockResolvedValue([{ documentId: 'doc-1' }, { documentId: 'doc-2' }]),
      },
      documentCollection: {
        update: jest.fn().mockResolvedValue({ id: collectionId, adminCreated: false }),
      },
    };
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
    (demoteAdminDocument as jest.Mock).mockResolvedValue(undefined);

    const result = await demoteCollection(collectionId);

    expect(tx.documentCollectionMembership.findMany).toHaveBeenCalledWith({
      where: { collectionId, document: { adminCreated: true } },
      select: { documentId: true },
    });
    expect(demoteAdminDocument).toHaveBeenCalledTimes(2);
    expect(demoteAdminDocument).toHaveBeenCalledWith('doc-1', tx);
    expect(demoteAdminDocument).toHaveBeenCalledWith('doc-2', tx);
    expect(tx.documentCollection.update).toHaveBeenCalledWith({
      where: { id: collectionId },
      data: { adminCreated: false },
    });
    expect(result).toEqual({ demotedCount: 2 });
  });

  it('clears the shared flag even when no documents are admin sources', async () => {
    const tx = {
      documentCollectionMembership: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      documentCollection: {
        update: jest.fn().mockResolvedValue({ id: collectionId, adminCreated: false }),
      },
    };
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

    const result = await demoteCollection(collectionId);

    expect(demoteAdminDocument).not.toHaveBeenCalled();
    expect(tx.documentCollection.update).toHaveBeenCalledWith({
      where: { id: collectionId },
      data: { adminCreated: false },
    });
    expect(result).toEqual({ demotedCount: 0 });
  });

  it('logs and throws a sanitized error on failure', async () => {
    const error = new Error('db error');
    (db.$transaction as jest.Mock).mockRejectedValue(error);

    await expect(demoteCollection(collectionId)).rejects.toThrow('Error removing folder share status');
    expect(logger.error).toHaveBeenCalledWith(`Error demoting collection: CollectionId: ${collectionId}`, error);
  });
});
