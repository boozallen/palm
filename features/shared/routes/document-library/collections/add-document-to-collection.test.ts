import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import addDocumentToCollection from '@/features/shared/dal/document-library/collections/addDocumentToCollection';

jest.mock('@/features/shared/dal/document-library/collections/addDocumentToCollection');

describe('add-document-to-collection route', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';
  const mockDocumentId = 'document-123';
  const mockMembership = {
    documentId: mockDocumentId,
    collectionId: mockCollectionId,
    addedAt: new Date('2026-06-17'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('adds document to collection successfully', async () => {
    (addDocumentToCollection as jest.Mock).mockResolvedValue(mockMembership);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
      })
    ).resolves.toEqual(mockMembership);

    expect(addDocumentToCollection).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
      userId: mockUserId,
    });
  });

  it('throws error if DAL throws error', async () => {
    (addDocumentToCollection as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.addDocumentToCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
      })
    ).rejects.toThrow();
  });
});
