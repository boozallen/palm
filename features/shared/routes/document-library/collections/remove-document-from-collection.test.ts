import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import removeDocumentFromCollection from '@/features/shared/dal/document-library/collections/removeDocumentFromCollection';

jest.mock(
  '@/features/shared/dal/document-library/collections/removeDocumentFromCollection'
);

describe('remove-document-from-collection route', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';
  const mockDocumentId = 'document-123';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('removes document from collection successfully', async () => {
    (removeDocumentFromCollection as jest.Mock).mockResolvedValue({
      success: true,
    });

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.removeDocumentFromCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
      })
    ).resolves.toEqual({ success: true });

    expect(removeDocumentFromCollection).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      collectionId: mockCollectionId,
      userId: mockUserId,
    });
  });

  it('throws error if DAL throws error', async () => {
    (removeDocumentFromCollection as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.removeDocumentFromCollection({
        documentId: mockDocumentId,
        collectionId: mockCollectionId,
      })
    ).rejects.toThrow();
  });
});
