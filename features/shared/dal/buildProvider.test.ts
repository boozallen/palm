import db from '@/server/db';
import buildProvider from './buildProvider';
import { AiProviderType, BedrockConfig } from '../types';
import { AiProvider } from '@prisma/client';

jest.mock('@/server/db', () => {
  return {
    apiConfigOpenAi: {
      findUnique: jest.fn(),
    },
    apiConfigAzureOpenAi: {
      findUnique: jest.fn(),
    },
    apiConfigAnthropic: {
      findUnique: jest.fn(),
    },
    apiConfigGemini: {
      findUnique: jest.fn(),
    },
    apiConfigBedrock: {
      findUnique: jest.fn(),
    },
  };
});

describe('buildProvider', () => {
  const mockApiConfigId = 'eb65a224-56aa-49bb-a681-dcc484ec422e';

  const mockBedrockConfig: BedrockConfig = {
    type: AiProviderType.Bedrock,
    accessKeyId: 'access-key-id',
    secretAccessKey: 'secret-access-key',
    sessionToken: 'session-token',
    region: 'region',
  };

  const mockProvider: AiProvider = {
    id: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
    label: 'AI Provider',
    aiProviderTypeId: AiProviderType.Bedrock,
    apiConfigType: AiProviderType.Bedrock,
    apiConfigId: mockApiConfigId,
    costPerInputToken: 0.0001,
    costPerOutputToken: 0.0001,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (db.apiConfigBedrock.findUnique as jest.Mock).mockResolvedValue({
      id: mockApiConfigId,
      ...mockBedrockConfig,
    });
  });

  afterEach(() => {
    mockProvider.aiProviderTypeId = AiProviderType.Bedrock;
    mockProvider.apiConfigType = AiProviderType.Bedrock;

  });

  it('builds bedrock provider', async () => {
    const result = await buildProvider(db, mockProvider);
    expect(result.config).toEqual({
      id: mockApiConfigId,
      ...mockBedrockConfig,
    });
  });

  it('throws error if bedrock config is not found', async () => {
    (db.apiConfigBedrock.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      buildProvider(db, mockProvider)
    ).rejects.toThrowError();
  });
});
