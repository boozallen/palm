import { KBFactory, KBFactoryConfig } from './factory';
import logger from '@/server/logger';
import getKnowledgeBaseAndProvider from './dal/getKnowledgeBaseAndProvider';
import { KbProviderType } from '@/features/shared/types';
import { BedrockSource, PalmKbApiSource } from './sources';
import { waitFor } from '@testing-library/react';
import { getConfig } from '@/server/config';

jest.mock('./dal/getKnowledgeBaseAndProvider');
jest.mock('./sources');

jest.mock('@/server/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    logLevel: undefined,
    logFormat: undefined,
    featureFlags: {},
  }),
}));

describe('KBFactory', () => {
  const userId = 'test-user-id';
  const config: KBFactoryConfig = { userId };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw an error if userId is missing', () => {
      expect(() => new KBFactory({ userId: '' })).toThrow('Missing required configuration properties');
      expect(logger.error).toHaveBeenCalledWith('Missing required configuration properties: config.userId');
    });

    it('should not throw an error if userId is provided', () => {
      expect(() => new KBFactory(config)).not.toThrow();
    });
  });

  describe('buildSource', () => {
    const knowledgeBaseId = 'test-kb-id';
    const knowledgeBase = { id: knowledgeBaseId, name: 'Test KB' };
    const kbProviderConfig = { apiKey: 'an-api-key', apiEndpoint: 'http://example.com' };
    const kbProvider = { kbProviderType: KbProviderType.KbProviderPalm, config: kbProviderConfig };

    beforeEach(() => {
      (getKnowledgeBaseAndProvider as jest.Mock).mockResolvedValue({ knowledgeBase, kbProvider });
      (PalmKbApiSource as jest.Mock).mockImplementation(() => ({}));
    });

    it('should return a BuildResult object on success', async () => {
      const factory = new KBFactory(config);
      const result = await factory.buildSource(knowledgeBaseId);

      expect(result).toEqual({
        source: expect.any(Object),
        provider: kbProvider,
        knowledgeBase,
      });
      expect(getKnowledgeBaseAndProvider).toHaveBeenCalledWith(knowledgeBaseId);
      expect(PalmKbApiSource).toHaveBeenCalledWith(kbProviderConfig);
    });

    it('should log an error and throw an error if getKnowledgeBaseAndProvider fails', async () => {
      const error = new Error('Test error');
      (getKnowledgeBaseAndProvider as jest.Mock).mockRejectedValue(error);

      const factory = new KBFactory(config);

      await expect(factory.buildSource(knowledgeBaseId)).rejects.toThrow(`Error building KB source for id ${knowledgeBaseId}`);
      expect(logger.error).toHaveBeenCalledWith(`Error building KB source for id ${knowledgeBaseId}`, error);
    });
  });

  describe('buildClient', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return an instance of PalmKbApiSource for KbProviderPalm', () => {
      const factory = new KBFactory(config);
      const kbProviderConfig = {
        apiKey: 'some-key',
        apiEndpoint: 'http://example.com',
      };
      const kbProvider = {
        label: 'Test Label',
        kbProviderType: KbProviderType.KbProviderPalm,
        config: kbProviderConfig,
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (PalmKbApiSource as jest.Mock).mockImplementation(() => ({}));

      const source = factory['buildClient'](kbProvider);

      expect(source).toEqual(expect.any(Object));
      expect(PalmKbApiSource).toHaveBeenCalledWith(kbProviderConfig);
    });

    it('should throw an error for unsupported provider types', () => {
      const factory = new KBFactory(config);
      const kbProvider = {
        label: 'Test Label',
        kbProviderType: 0,
        config: { apiKey: '', apiEndpoint: '' },
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => factory['buildClient'](kbProvider)).toThrow(
        'Unimplemented provider source'
      );
    });

    it('should return an instance of BedrockSource for kbProviderAWSBedrock', () => {
      const kbProviderConfig = {
        accessKeyId: 'testId',
        secretAccessKey: 'testKey',
        sessionToken: 'testToken',
        region: 'testRegion',
      };
      const kbProvider = {
        label: 'Test Label',
        kbProviderType: KbProviderType.KbProviderBedrock,
        config: kbProviderConfig,
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const factory = new KBFactory(config);

      factory['buildClient'](kbProvider);
      waitFor(() => {
        expect(BedrockSource).toHaveBeenCalledWith(kbProviderConfig);
      });
    });

    it('should call bedrock constructor with env if DB config is an object with empty strings', () => {
      const mockBedrockConfig = {
        accessKeyId: 'envAccessKey',
        secretAccessKey: 'envSecret',
        sessionToken: 'envSession',
        region: 'envRegion',
      };
      (getConfig as jest.Mock).mockReturnValue({
        bedrock: mockBedrockConfig,
      });

      const kbProviderConfig = {
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        region: '',
      };
      const kbProvider = {
        label: 'Test Label',
        kbProviderType: KbProviderType.KbProviderBedrock,
        config: kbProviderConfig,
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const factory = new KBFactory(config);

      factory['buildClient'](kbProvider);

      waitFor(() => {
        expect(BedrockSource).toHaveBeenCalledWith(mockBedrockConfig);
      });
    });
  });
});

