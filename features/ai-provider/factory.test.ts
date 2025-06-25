import logger from '@/server/logger';
import { AIFactory } from './factory';
import { AiProviderType, Provider, ProviderConfig } from '@/features/shared/types';
import { BedrockSource } from './sources';
import { getConfig } from '@/server/config';

jest.mock('./sources', () => ({
  BedrockSource: jest.fn(),
}));
jest.mock('@/server/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    bedrock: {},
    featureFlags: {},
  }),
}));

const mockAIFactoryConfig = {
  userId: 'test-user-id',
};

describe('AIFactory class', () => {

  describe('constructor', () => {
    it('should succeed with properly structured configuration', async () => {
      expect(() => new AIFactory(mockAIFactoryConfig)).not.toThrow();
    });

    it('should fail when config is incomplete', () => {
      const incompleteConfig = {
        // Intentionally missing 'userId' '
      };
      expect(() => new AIFactory(incompleteConfig as any)).toThrow('Missing required configuration properties');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('buildClient', () => {
    const mockBedrockConfig: ProviderConfig = {
      id: '08448b83-6f73-49dc-9142-84ea722a162c',
      type: AiProviderType.Bedrock,
      accessKeyId: 'testAccessKeyId',
      secretAccessKey: 'testSecret',
      region: 'us-east-1',
    };

    const mockProvider: Provider = {
      id: 'ca60ed47-d7bf-4cb9-80b7-9fadc43ab99e',
      typeId: AiProviderType.Bedrock,
      label: 'Mock Provider',
      configTypeId: AiProviderType.Bedrock,
      config: mockBedrockConfig,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let aiFactory: AIFactory;

    beforeEach(() => {
      jest.clearAllMocks();

      aiFactory = new AIFactory(mockAIFactoryConfig);
    });

    it('builds bedrock client', () => {
      aiFactory['buildClient'](mockProvider);
      expect(BedrockSource).toHaveBeenCalled();
    });

    it('resorts to env config if accessKeyId is missing', () => {
      const missingBedrockConfig = {
        ...mockBedrockConfig,
        accessKeyId: '',
      };

      aiFactory['buildClient']({
        ...mockProvider,
        config: missingBedrockConfig,
      });

      expect(getConfig as jest.Mock).toHaveBeenCalled();
    });
  });
});
