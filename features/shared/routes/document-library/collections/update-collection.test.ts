import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import updateCollection from '@/features/shared/dal/document-library/collections/updateCollection';

jest.mock('@/features/shared/dal/document-library/collections/updateCollection');

describe('update-collection route', () => {
  const mockUserId = 'user-123';
  const mockCollectionId = 'collection-123';
  const mockUpdatedCollection = {
    id: mockCollectionId,
    name: 'Updated Name',
    color: '#00FF00',
    userId: mockUserId,
    createdAt: new Date('2026-06-17'),
    updatedAt: new Date('2026-06-17'),
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('updates collection name and color', async () => {
    (updateCollection as jest.Mock).mockResolvedValue(mockUpdatedCollection);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.updateCollection({
        collectionId: mockCollectionId,
        name: 'Updated Name',
        color: '#00FF00',
      })
    ).resolves.toEqual(mockUpdatedCollection);

    expect(updateCollection).toHaveBeenCalledWith({
      collectionId: mockCollectionId,
      name: 'Updated Name',
      color: '#00FF00',
      userId: mockUserId,
    });
  });

  it('updates only name', async () => {
    (updateCollection as jest.Mock).mockResolvedValue(mockUpdatedCollection);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.updateCollection({
        collectionId: mockCollectionId,
        name: 'Updated Name',
      })
    ).resolves.toEqual(mockUpdatedCollection);

    expect(updateCollection).toHaveBeenCalledWith({
      collectionId: mockCollectionId,
      name: 'Updated Name',
      userId: mockUserId,
    });
  });

  it('updates only color', async () => {
    (updateCollection as jest.Mock).mockResolvedValue(mockUpdatedCollection);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.updateCollection({
        collectionId: mockCollectionId,
        color: '#00FF00',
      })
    ).resolves.toEqual(mockUpdatedCollection);

    expect(updateCollection).toHaveBeenCalledWith({
      collectionId: mockCollectionId,
      color: '#00FF00',
      userId: mockUserId,
    });
  });

  it('throws error if DAL throws error', async () => {
    (updateCollection as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.updateCollection({
        collectionId: mockCollectionId,
        name: 'Updated Name',
      })
    ).rejects.toThrow();
  });

  it('validates name min length when provided', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.updateCollection({
        collectionId: mockCollectionId,
        name: '',
      })
    ).rejects.toThrow();
  });

  it('validates name max length when provided', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.updateCollection({
        collectionId: mockCollectionId,
        name: 'a'.repeat(101),
      })
    ).rejects.toThrow();
  });
});
