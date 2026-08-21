import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import deleteCollection from '@/features/shared/dal/document-library/collections/deleteCollection';

jest.mock('@/features/shared/dal/document-library/collections/deleteCollection');

describe('delete-collection route', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('deletes collection successfully', async () => {
    (deleteCollection as jest.Mock).mockResolvedValue({ success: true });

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.deleteCollection({
        collectionId: mockCollectionId,
      })
    ).resolves.toEqual({ success: true });

    expect(deleteCollection).toHaveBeenCalledWith({
      collectionId: mockCollectionId,
      userId: mockUserId,
    });
  });

  it('throws error if DAL throws error', async () => {
    (deleteCollection as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.deleteCollection({
        collectionId: mockCollectionId,
      })
    ).rejects.toThrow();
  });
});
