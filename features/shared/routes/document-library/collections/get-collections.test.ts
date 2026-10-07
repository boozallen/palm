import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getCollections from '@/features/shared/dal/document-library/collections/getCollections';

jest.mock('@/features/shared/dal/document-library/collections/getCollections');

describe('get-collections route', () => {
  const mockUserId = 'user-123';
  const mockCollectionsResponse = [
    {
      id: 'collection-1',
      name: 'Collection A',
      color: '#FF0000',
      userId: mockUserId,
      createdAt: new Date('2026-06-17'),
      updatedAt: new Date('2026-06-17'),
      documentCount: 5,
    },
    {
      id: 'collection-2',
      name: 'Collection B',
      color: '#00FF00',
      userId: mockUserId,
      createdAt: new Date('2026-06-16'),
      updatedAt: new Date('2026-06-16'),
      documentCount: 3,
    },
  ];

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('returns collections for user', async () => {
    (getCollections as jest.Mock).mockResolvedValue(mockCollectionsResponse);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.getCollections()
    ).resolves.toEqual({
      collections: mockCollectionsResponse,
    });

    expect(getCollections).toHaveBeenCalledWith({
      userId: mockUserId,
    });
  });

  it('returns empty array when no collections exist', async () => {
    (getCollections as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.getCollections()
    ).resolves.toEqual({
      collections: [],
    });
  });

  it('throws error if DAL throws error', async () => {
    (getCollections as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.documentCollections.getCollections()).rejects.toThrow();
  });
});
