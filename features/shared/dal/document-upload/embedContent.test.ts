import { AIFactory } from '@/features/ai-provider/factory';
import { embedContent } from '@/features/shared/dal/document-upload/embedContent';

jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn(),
}));

jest.mock('@/features/settings/dal/ai-providers/getFirstAvailableBedrockModel', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const MockedAIFactory = AIFactory as jest.MockedClass<typeof AIFactory>;

import getFirstAvailableBedrockModel from '@/features/settings/dal/ai-providers/getFirstAvailableBedrockModel';
const mockGetFirstAvailableBedrockModel = getFirstAvailableBedrockModel as jest.MockedFunction<typeof getFirstAvailableBedrockModel>;

describe('embedContent', () => {
  const userMessage = 'Hello, this is a test message';
  const userId = 'test-user-id';
  const mockEmbeddings = [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully generate embeddings using AIFactory', async () => {
    // Mock Bedrock model lookup
    const mockBedrockModel = {
      id: 'model-123',
      aiProviderId: 'provider-456',
      name: 'Titan Embedding Model',
      externalId: 'amazon.titan-embed-text-v1',
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.0001,
    };
    mockGetFirstAvailableBedrockModel.mockResolvedValue(mockBedrockModel);

    // Mock AIFactory and source
    const mockSource = {
      createEmbeddings: jest.fn().mockResolvedValue({
        embeddings: mockEmbeddings,
      }),
    };
    const mockBuildResult = { source: mockSource };
    const mockFactoryInstance = {
      buildUserSource: jest.fn().mockResolvedValue(mockBuildResult),
    };
    MockedAIFactory.mockImplementation(() => mockFactoryInstance as any);

    const result = await embedContent(userMessage, userId);

    expect(mockGetFirstAvailableBedrockModel).toHaveBeenCalledTimes(1);
    expect(MockedAIFactory).toHaveBeenCalledWith({ userId });
    expect(mockFactoryInstance.buildUserSource).toHaveBeenCalledWith(mockBedrockModel.id);
    expect(mockSource.createEmbeddings).toHaveBeenCalledWith(
      [userMessage],
      {
        model: '', // Model is hardcoded in BedrockSource.createEmbeddings (like OpenAI)
        randomness: 0.2,
        repetitiveness: 0.5,
        bestOf: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      }
    );
    expect(result).toEqual({ embeddings: mockEmbeddings });
  });

  it('should throw an error when no Bedrock model is configured', async () => {
    // Mock no model found
    mockGetFirstAvailableBedrockModel.mockResolvedValue(null);

    await expect(embedContent(userMessage, userId)).rejects.toThrow(
      'No Bedrock AI provider and model configured. Please configure a Bedrock AI provider first.'
    );

    expect(mockGetFirstAvailableBedrockModel).toHaveBeenCalledTimes(1);
  });
});
