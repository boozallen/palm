import { processDocuments } from '@/features/chat/utils/chatContextHelpers';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';

jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn(),
}));
jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () =>
  jest.fn(),
);
jest.mock('@/features/chat/dal/getEmbeddingsForDocuments', () => jest.fn());

describe('processDocuments', () => {
  const userId = 'e3ff745d-e250-4980-9f2b-eb47f0a8b195';
  const documentIds = ['2f1c9e7a-5b3d-4c8e-9a1f-6d2b8c4e7a03'];

  beforeEach(() => {
    jest.clearAllMocks();
    (getAccessibleDocumentIds as jest.Mock).mockResolvedValue(new Set(documentIds));
    (embedContent as jest.Mock).mockResolvedValue({ embeddings: [] });
  });

  // Query embeddings are charged to whatever asked for the retrieval, so the
  // caller's attribution has to survive this hop.
  it('forwards attribution to embedContent', async () => {
    const attribution = { chatMessageId: 'msg-1', stepLabel: 'query embedding' };

    await processDocuments('hello', userId, documentIds, false, false, attribution);

    expect(embedContent).toHaveBeenCalledWith(
      'hello',
      userId,
      undefined,
      attribution,
    );
  });

  // Three existing callers pass nothing; they must keep working and simply write
  // unattributed rows.
  it('omits attribution when the caller gives none', async () => {
    await processDocuments('hello', userId, documentIds);

    expect(embedContent).toHaveBeenCalledWith('hello', userId, undefined, undefined);
  });
});
