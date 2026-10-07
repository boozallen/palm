import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import type { Document } from '@/features/shared/types/document';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/shared/dal/document-library/upload/getDocument');

const mockGetDocument = getDocument as jest.MockedFunction<typeof getDocument>;

describe('shared.getDocumentContent', () => {
  const mockUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockDocAccessible = 'd11d11d1-d11d-d11d-d11d-d11d11d11d11';
  const mockDocInaccessible = 'd22d22d2-d22d-d22d-d22d-d22d22d22d22';

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const createCaller = (accessibleIds: string[] = [mockDocAccessible]) => {
    const ctx = {
      userId: mockUserId,
      logger: mockLogger,
      getAccessibleDocIds: jest.fn().mockResolvedValue(
        new Set(accessibleIds) as unknown as AccessibleDocIds,
      ),
    } as unknown as ContextType;

    return sharedRouter.createCaller(ctx);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns document content when the doc is accessible', async () => {
    mockGetDocument.mockResolvedValue({
      id: mockDocAccessible,
      text: 'document body text',
    } as unknown as Document);

    const caller = createCaller();
    const result = await caller.getDocumentContent({ documentId: mockDocAccessible });

    expect(result).toEqual({ id: mockDocAccessible, text: 'document body text' });
    expect(mockGetDocument).toHaveBeenCalledWith(mockDocAccessible);
  });

  it('coerces missing document text to null', async () => {
    mockGetDocument.mockResolvedValue({
      id: mockDocAccessible,
      text: null,
    } as unknown as Document);

    const caller = createCaller();
    const result = await caller.getDocumentContent({ documentId: mockDocAccessible });

    expect(result.text).toBeNull();
  });

  it('rejects when the document is not in the accessible set (single-id form)', async () => {
    const caller = createCaller([mockDocAccessible]);

    await expect(
      caller.getDocumentContent({ documentId: mockDocInaccessible }),
    ).rejects.toThrow('One or more documents are not accessible');

    expect(mockGetDocument).not.toHaveBeenCalled();
  });

  it('throws NotFound when the document does not exist in the DB', async () => {
    mockGetDocument.mockResolvedValue(null);

    const caller = createCaller();

    await expect(
      caller.getDocumentContent({ documentId: mockDocAccessible }),
    ).rejects.toThrow('Document not found');
  });
});
