import { AiSettings } from '@/types';
import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import { AiFactoryEmbeddingsAdapter } from '@/features/ai-agents/utils/aiFactoryEmbeddingsAdapter';
import logger from '@/server/logger';

describe('AiFactoryEmbeddingsAdapter', () => {
  let stubAi: BuildResult;
  let defaultSettings: AiSettings;

  const createEmbeddings = jest.fn();
  const mockInput = 'Hello, World!';

  beforeEach(() => {
    jest.clearAllMocks();

    stubAi = {
      model: {
        externalId: 'stub-model-id',
      },
      source: {
        createEmbeddings,
      },
    } as unknown as BuildResult;

    defaultSettings = {
      model: stubAi.model.externalId,
      randomness: 0.0,
      repetitiveness: 1,
      bestOf: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    };
  });

  describe('getTextEmbedding', () => {
    it('calls createEmbeddings with correct input', async () => {
      createEmbeddings.mockResolvedValue({
        embeddings: [{ embedding: [1, 2, 3] }],
      });

      const adapter = new AiFactoryEmbeddingsAdapter(stubAi);
      await adapter.getTextEmbedding(mockInput);

      expect(createEmbeddings).toHaveBeenCalledWith([mockInput], defaultSettings);
    });

    it('returns the embedding', async () => {
      createEmbeddings.mockResolvedValue({
        embeddings: [{ embedding: [1, 2, 3] }],
      });

      const adapter = new AiFactoryEmbeddingsAdapter(stubAi);
      await expect(
        adapter.getTextEmbedding(mockInput)
      ).resolves.toEqual([1, 2, 3]);
    });

    it('throws and logs an error if there are no embeddings', async () => {
      createEmbeddings.mockResolvedValue({});

      const adapter = new AiFactoryEmbeddingsAdapter(stubAi);
      await expect(
        adapter.getTextEmbedding(mockInput)
      ).rejects.toThrow('Error creating text embedding');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create embeddings: ',
        expect.any(TypeError)
      );
    });

    it('throws and logs an error if createEmbeddings throws', async () => {
      const mockError = new Error('This is an error');

      createEmbeddings.mockRejectedValue(mockError);

      const adapter = new AiFactoryEmbeddingsAdapter(stubAi);
      await expect(
        adapter.getTextEmbedding(mockInput)
      ).rejects.toThrow('Error creating text embedding');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create embeddings: ',
        mockError
      );
    });
  });
});
