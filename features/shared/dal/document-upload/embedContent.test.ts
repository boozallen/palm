import { AIFactory } from '@/features/ai-provider';
import getFirstAvailableOpenAiModel from '@/features/settings/dal/getFirstAvailableOpenAiModel';
import { embedContent } from '@/features/shared/dal/document-upload/embedContent';

jest.mock('@/features/settings/dal/getFirstAvailableOpenAiModel');
jest.mock('@/features/ai-provider', () => ({
  AIFactory: jest.fn(),
}));

const mockGetFirstAvailableOpenAiModel = getFirstAvailableOpenAiModel as jest.Mock;
const MockedAIFactory = AIFactory as jest.MockedClass<typeof AIFactory>;

describe('embedContent', () => {
  const userId = 'test-user-id';
  const userMessage = 'Hello, this is a test message';
  const mockModel = {
    id: 'model-123',
    externalId: 'gpt-3.5-turbo',
    aiProviderId: 'provider-123',
    name: 'GPT-3.5 Turbo',
    costPerInputToken: 0.001,
    costPerOutputToken: 0.002,
  };
  const mockEmbeddings = [[0.1, 0.2, 0.3, 0.4, 0.5]];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully generate embeddings for a user message', async () => {
    const mockSource = {
      createEmbeddings: jest.fn().mockResolvedValue({
        embeddings: mockEmbeddings,
      }),
    };

    const mockAI = {
      source: mockSource,
      model: mockModel,
    };

    const mockAIInstance = {
      buildSystemSource: jest.fn().mockResolvedValue(mockAI),
    };

    mockGetFirstAvailableOpenAiModel.mockResolvedValue(mockModel);
    MockedAIFactory.mockImplementation(() => mockAIInstance as any);

    const result = await embedContent(userId, userMessage);

    expect(mockGetFirstAvailableOpenAiModel).toHaveBeenCalledTimes(1);
    expect(MockedAIFactory).toHaveBeenCalledWith({ userId });
    expect(mockAIInstance.buildSystemSource).toHaveBeenCalledWith(mockModel.id);
    expect(mockSource.createEmbeddings).toHaveBeenCalledWith(
      [userMessage],
      {
        model: mockModel.externalId,
        randomness: 0.2,
        repetitiveness: 0.5,
      }
    );
    expect(result).toEqual({ embeddings: mockEmbeddings });
  });

  it('should throw an error when no OpenAI model is available', async () => {
    const userId = 'test-user-id';
    const userMessage = 'Hello, this is a test message';

    mockGetFirstAvailableOpenAiModel.mockResolvedValue(null);

    await expect(embedContent(userId, userMessage)).rejects.toThrow(
      /openai provider must be configured/i
    );

    expect(mockGetFirstAvailableOpenAiModel).toHaveBeenCalledTimes(1);
    expect(MockedAIFactory).not.toHaveBeenCalled();
  });
});
