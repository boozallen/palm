import db from '@/server/db';
import logger from '@/server/logger';
import getAvailableProviders from './getAvailableProviders';
import { AiProviderType } from '../types';

jest.mock('@/server/db', () => {
  return {
    aiProvider: {
      findMany: jest.fn(),
    },
  };
});

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getAvailableProviders', () => {
  const mockProviders = [
    {
      id: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
      aiProviderTypeId: AiProviderType.OpenAi,
      label: 'OpenAI Provider',
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.0001,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      deletedAt: null,
    },
    {
      id: '6f945e6e-3f95-40f0-aec7-87c966956fe5',
      aiProviderTypeId: AiProviderType.Anthropic,
      label: 'Anthropic Provider',
      costPerInputToken: 0.0002,
      costPerOutputToken: 0.0002,
      createdAt: new Date('2023-01-03'),
      updatedAt: new Date('2023-01-04'),
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (db.aiProvider.findMany as jest.Mock).mockResolvedValue(mockProviders);
  });

  it('should return available providers', async () => {
    const result = await getAvailableProviders();

    expect(result).toEqual([
      {
        id: '5f945e6e-3f95-40f0-aec7-87c966956fe4',
        typeId: AiProviderType.OpenAi,
        label: 'OpenAI Provider',
        costPerInputToken: 0.0001,
        costPerOutputToken: 0.0001,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      },
      {
        id: '6f945e6e-3f95-40f0-aec7-87c966956fe5',
        typeId: AiProviderType.Anthropic,
        label: 'Anthropic Provider',
        costPerInputToken: 0.0002,
        costPerOutputToken: 0.0002,
        createdAt: new Date('2023-01-03'),
        updatedAt: new Date('2023-01-04'),
      },
    ]);

    expect(db.aiProvider.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
    });
  });

  it('should return empty array when no providers found', async () => {
    (db.aiProvider.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getAvailableProviders();

    expect(result).toEqual([]);
  });

  it('should handle database errors', async () => {
    const mockError = new Error('Database connection failed');
    (db.aiProvider.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getAvailableProviders()).rejects.toThrow('Error fetching available AI providers');

    expect(logger.error).toHaveBeenCalledWith('Error fetching available AI providers', mockError);
  });
});