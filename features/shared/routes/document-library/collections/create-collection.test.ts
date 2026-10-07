import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import createCollection from '@/features/shared/dal/document-library/collections/createCollection';

jest.mock('@/features/shared/dal/document-library/collections/createCollection');

describe('create-collection route', () => {
  const mockUserId = 'user-123';
  const mockCollection = {
    id: 'collection-123',
    name: 'My Collection',
    color: '#FF0000',
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

  it('creates a collection with name and color', async () => {
    (createCollection as jest.Mock).mockResolvedValue(mockCollection);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.createCollection({
        name: 'My Collection',
        color: '#FF0000',
      })
    ).resolves.toEqual(mockCollection);

    expect(createCollection).toHaveBeenCalledWith({
      name: 'My Collection',
      color: '#FF0000',
      userId: mockUserId,
    });
  });

  it('creates a collection with name only', async () => {
    const mockCollectionWithDefaultColor = {
      ...mockCollection,
      color: '#228BE6',
    };

    (createCollection as jest.Mock).mockResolvedValue(
      mockCollectionWithDefaultColor
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.createCollection({
        name: 'My Collection',
      })
    ).resolves.toEqual(mockCollectionWithDefaultColor);

    expect(createCollection).toHaveBeenCalledWith({
      name: 'My Collection',
      userId: mockUserId,
    });
  });

  it('throws error if DAL throws error', async () => {
    (createCollection as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.createCollection({
        name: 'My Collection',
      })
    ).rejects.toThrow();
  });

  it('validates name is required', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.createCollection({
        name: '',
      })
    ).rejects.toThrow();
  });

  it('validates name max length', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.createCollection({
        name: 'a'.repeat(101),
      })
    ).rejects.toThrow();
  });
});
