import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getDocumentCollections from '@/features/shared/dal/document-library/collections/getDocumentCollections';

jest.mock('@/features/shared/dal/document-library/collections/getDocumentCollections');

describe('get-document-collections route', () => {
  const mockUserId = 'user-123';
  const mockDocumentId = 'document-123';
  const mockCollections = [
    {
      id: 'collection-1',
      name: 'Collection A',
      color: '#FF0000',
      userId: mockUserId,
      createdAt: new Date('2026-06-17'),
      updatedAt: new Date('2026-06-17'),
    },
    {
      id: 'collection-2',
      name: 'Collection B',
      color: '#00FF00',
      userId: mockUserId,
      createdAt: new Date('2026-06-16'),
      updatedAt: new Date('2026-06-16'),
    },
  ];

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('returns collections for document', async () => {
    (getDocumentCollections as jest.Mock).mockResolvedValue(mockCollections);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.getDocumentCollections({
        documentId: mockDocumentId,
      })
    ).resolves.toEqual({
      collections: mockCollections,
    });

    expect(getDocumentCollections).toHaveBeenCalledWith({
      documentId: mockDocumentId,
      userId: mockUserId,
    });
  });

  it('returns empty array when document has no collections', async () => {
    (getDocumentCollections as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.getDocumentCollections({
        documentId: mockDocumentId,
      })
    ).resolves.toEqual({
      collections: [],
    });
  });

  it('throws error if DAL throws error', async () => {
    (getDocumentCollections as jest.Mock).mockRejectedValueOnce(
      new Error('Test error')
    );

    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.documentCollections.getDocumentCollections({
        documentId: mockDocumentId,
      })
    ).rejects.toThrow();
  });
});
