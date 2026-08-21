import { callAnalyzeData, callSearch } from '@/features/shared/services/mcpTools';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import db from '@/server/db';

jest.mock('@/features/shared/dal/document-library/upload/embedContent');
jest.mock('@/features/chat/dal/getEmbeddingsForDocuments');
jest.mock('@/features/shared/dal/getAccessibleDocumentIds');
jest.mock('@/server/db', () => ({
  document: { findFirst: jest.fn(), findMany: jest.fn() },
  model: { findUnique: jest.fn() },
}));

const mockEmbedContent = embedContent as jest.MockedFunction<typeof embedContent>;
const mockGetEmbeddings = getEmbeddingsForDocuments as jest.MockedFunction<typeof getEmbeddingsForDocuments>;
const mockGetAccessible = getAccessibleDocumentIds as jest.MockedFunction<typeof getAccessibleDocumentIds>;

const CHAT_MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

describe('callSearch attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbedContent.mockResolvedValue({ embeddings: [{ embedding: [0.1, 0.2] }] } as Awaited<ReturnType<typeof embedContent>>);
    mockGetEmbeddings.mockResolvedValue([]);
    mockGetAccessible.mockResolvedValue(new Set() as unknown as Awaited<ReturnType<typeof getAccessibleDocumentIds>>);
  });

  it('attributes the query embedding to the chat message that caused it', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      chatMessageId: CHAT_MESSAGE_ID,
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      { chatMessageId: CHAT_MESSAGE_ID, stepLabel: 'query embedding' },
    );
  });

  it('omits attribution when the chat message id is not a valid id', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      chatMessageId: 'msg-1',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
    );
  });

  it('omits attribution when no chat message id is supplied', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
    );
  });

  it('omits attribution when the chat message id is an empty string', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      chatMessageId: '',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
    );
  });
});

describe('callAnalyzeData attribution', () => {
  const analyzeArgs = {
    userId: 'user-1',
    documentId: 'doc-1',
    question: 'what was total revenue by month',
    modelId: 'model-1',
  };

  const sentBody = (): Record<string, unknown> =>
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);

  beforeEach(() => {
    jest.clearAllMocks();
    (db.document.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      filename: 'sales.xlsx',
      text: 'month,revenue\nJan,100',
      dataProfile: null,
    });
    (db.model.findUnique as jest.Mock).mockResolvedValue({ externalId: 'claude-sonnet-4' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'Revenue was 100 in Jan', code: 'df.sum()' }),
    });
  });

  it('attributes the analysis agent to the chat message that caused it', async () => {
    await callAnalyzeData({ ...analyzeArgs, chatMessageId: CHAT_MESSAGE_ID });

    expect(sentBody().chat_message_id).toBe(CHAT_MESSAGE_ID);
  });

  it('omits attribution when the chat message id is not a valid id', async () => {
    await callAnalyzeData({ ...analyzeArgs, chatMessageId: 'msg-1' });

    expect(sentBody().chat_message_id).toBeNull();
  });

  it('omits attribution when no chat message id is supplied', async () => {
    await callAnalyzeData(analyzeArgs);

    expect(sentBody().chat_message_id).toBeNull();
  });

  it('omits attribution when the chat message id is an empty string', async () => {
    await callAnalyzeData({ ...analyzeArgs, chatMessageId: '' });

    expect(sentBody().chat_message_id).toBeNull();
  });
});
