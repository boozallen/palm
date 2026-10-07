import { AIFactory } from '@/features/ai-provider/factory';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';

jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn(),
}));

const MockedAIFactory = AIFactory as jest.MockedClass<typeof AIFactory>;

describe('embedContent', () => {
  const userMessage = 'Hello, this is a test message';
  const userId = 'test-user-id';
  const modelExternalId = 'amazon.titan-embed-text-v1';
  const mockEmbeddings = [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }];

  const buildMocks = () => {
    const mockSource = {
      createEmbeddings: jest.fn().mockResolvedValue({
        embeddings: mockEmbeddings,
      }),
    };
    const mockFactoryInstance = {
      buildEmbeddingSource: jest.fn().mockResolvedValue({
        source: mockSource,
        model: { id: 'embedding-model-id', externalId: modelExternalId },
      }),
    };
    MockedAIFactory.mockImplementation(() => mockFactoryInstance as any);

    return { mockSource, mockFactoryInstance };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully generate embeddings using AIFactory', async () => {
    const { mockSource, mockFactoryInstance } = buildMocks();

    const result = await embedContent(userMessage, userId);

    expect(MockedAIFactory).toHaveBeenCalledWith({ userId });
    // No model id passed, so buildEmbeddingSource resolves the designated one.
    expect(mockFactoryInstance.buildEmbeddingSource).toHaveBeenCalledTimes(1);
    expect(mockFactoryInstance.buildEmbeddingSource).toHaveBeenCalledWith(undefined, { attribution: undefined });
    expect(mockSource.createEmbeddings).toHaveBeenCalledWith(
      [userMessage],
      {
        // The source invokes whatever externalId it is handed, so the resolved
        // model has to be named here.
        model: modelExternalId,
        temperature: 0.2,
        topP: 0.5,
        frequencyPenalty: 0,
        presencePenalty: 0,
      },
    );
    expect(result).toEqual({ embeddings: mockEmbeddings });
  });

  it('should forward attribution to buildEmbeddingSource so the embedding can be tied back to a document', async () => {
    const { mockFactoryInstance } = buildMocks();

    await embedContent(userMessage, userId, undefined, { documentId: 'doc-1', stepLabel: 'ingestion' });

    expect(mockFactoryInstance.buildEmbeddingSource).toHaveBeenCalledWith(undefined, {
      attribution: { documentId: 'doc-1', stepLabel: 'ingestion' },
    });
  });

  it('should accept an array of content', async () => {
    const contents = ['first chunk', 'second chunk'];
    const { mockSource } = buildMocks();

    await embedContent(contents, userId);

    expect(mockSource.createEmbeddings).toHaveBeenCalledWith(
      contents,
      expect.any(Object),
    );
  });

  it('should pass a caller-resolved model id through to the factory', async () => {
    const { mockFactoryInstance } = buildMocks();

    await embedContent(userMessage, userId, 'pre-resolved-model-id');

    expect(mockFactoryInstance.buildEmbeddingSource).toHaveBeenCalledWith(
      'pre-resolved-model-id',
      { attribution: undefined },
    );
  });

  it('should propagate the error when no embedding model is designated', async () => {
    const mockFactoryInstance = {
      buildEmbeddingSource: jest.fn().mockRejectedValue(
        new Error('No embedding model is configured. Ask an administrator to designate a model as embeddings only on an AI provider you have access to.'),
      ),
    };
    MockedAIFactory.mockImplementation(() => mockFactoryInstance as any);

    await expect(embedContent(userMessage, userId)).rejects.toThrow(
      'No embedding model is configured. Ask an administrator to designate a model as embeddings only on an AI provider you have access to.',
    );

    expect(mockFactoryInstance.buildEmbeddingSource).toHaveBeenCalledTimes(1);
  });

  // The attribution is the only record of what an embedding was for; without it
  // the row cannot be totalled toward an artifact.
  it('forwards attribution to the factory', async () => {
    const { mockFactoryInstance } = buildMocks();
    const attribution = { documentId: 'doc-1', stepLabel: 'ingestion' };

    await embedContent(userMessage, userId, 'embedding-model-id', attribution);

    expect(mockFactoryInstance.buildEmbeddingSource).toHaveBeenCalledWith(
      'embedding-model-id',
      { attribution },
    );
  });

  it('attributes usage to the caller\'s selected user group', async () => {
    buildMocks();

    await embedContent(userMessage, userId, undefined, undefined, 'group-9');

    expect(MockedAIFactory).toHaveBeenCalledWith({ userId, userGroupId: 'group-9' });
  });
});
