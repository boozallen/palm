import db from '@/server/db';
import logger from '@/server/logger';
import { InitiatedBy, TimeRange } from '@/features/settings/types/analytics';
import getUsageRecords from './getUsageRecords';

jest.mock('@prisma/client');
jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
  aiProvider: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  model: {
    findUnique: jest.fn(),
  },
}));

jest.mock('@/features/settings/dal/getUserGroup');

describe('getUsageRecords', () => {
  const mockAiProviderId = '2db90cb6-ecbc-47d8-b260-bd09b2c7cbd1';
  const mockAiProviderLabel = 'OpenAI';
  const mockInitiatedBy = InitiatedBy.Any;

  const mockModelId = 'all';
  const mockModelLabel = undefined;
  const mockTimeRange = TimeRange.Day;

  const mockProviderId = '8c852dec-ea46-4f63-a980-e52ba9ca9a54';
  const mockModelOneId = '413e3d33-c06c-4dba-a391-1481dc2f41ef';
  const mockModelTwoId = 'b4513ace-5d28-48e1-a660-941cac060747';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return usage records with total cost and providers', async () => {
    const mockRawRecords = [
      {
        aiProviderId: mockProviderId,
        aiProviderLabel: 'Provider 1',
        providerTotalCost: 110,
        modelId: mockModelOneId,
        modelLabel: 'Model 1',
        modelTotalCost: 50,
        overallTotalCost: 110,
      },
      {
        aiProviderId: mockProviderId,
        aiProviderLabel: 'Provider 1',
        costPerInputToken: 1.5,
        costPerOutputToken: 2,
        providerTotalCost: 110,
        modelId: mockModelTwoId,
        modelLabel: 'Model 2',
        modelTotalCost: 60,
        overallTotalCost: 110,
      },
    ];

    (db.aiProvider.findUnique as jest.Mock).mockResolvedValue({ label: mockAiProviderLabel });
    (db.$queryRaw as jest.Mock).mockResolvedValue(mockRawRecords);
    (db.aiProvider.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockProviderId,
        label: 'Provider 1',
        models: [
          { id: mockModelOneId, name: 'Model 1' },
          { id: mockModelTwoId, name: 'Model 2' },
        ],
      }]);

    const result = await getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange
    );

    expect(result).toEqual({
      initiatedBy: mockInitiatedBy,
      aiProvider: mockAiProviderLabel,
      model: mockModelLabel,
      timeRange: mockTimeRange,
      totalCost: mockRawRecords[0].overallTotalCost,
      providers: [
        {
          id: mockRawRecords[0].aiProviderId,
          label: mockRawRecords[0].aiProviderLabel,
          costPerInputToken: mockRawRecords[0].costPerInputToken,
          costPerOutputToken: mockRawRecords[0].costPerOutputToken,
          cost: mockRawRecords[0].providerTotalCost,
          models: [
            { id: mockRawRecords[0].modelId, label: mockRawRecords[0].modelLabel, cost: mockRawRecords[0].modelTotalCost },
            { id: mockRawRecords[1].modelId, label: mockRawRecords[1].modelLabel, cost: mockRawRecords[1].modelTotalCost },
          ],
        },
      ],
    });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should return records with 0 cost if no records are found', async () => {
    (db.aiProvider.findUnique as jest.Mock).mockResolvedValue({ label: mockAiProviderLabel });
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);
    (db.aiProvider.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockProviderId,
        label: 'Provider 1',
        models: [
          { id: mockModelOneId, name: 'Model 1' },
          { id: mockModelTwoId, name: 'Model 2' },
        ],
      }]);

    const result = await getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange
    );

    expect(result).toEqual({
      initiatedBy: mockInitiatedBy,
      aiProvider: mockAiProviderLabel,
      model: undefined,
      timeRange: mockTimeRange,
      totalCost: 0,
      providers: [
        {
          id: mockProviderId,
          label: 'Provider 1',
          costPerInputToken: undefined,
          costPerOutputToken: undefined,
          cost: 0,
          models: [
            { id: mockModelOneId, label: 'Model 1', cost: 0 },
            { id: mockModelTwoId, label: 'Model 2', cost: 0 },
          ],
        },
      ],
    });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if the query returns null', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue(null);

    await expect(getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange
    )).rejects.toThrow(
      'Error fetching usage records'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching usage records',
      new Error('Unexpected null result from database query.')
    );
  });

  it('should throw an error if total cost is null', async () => {
    const mockRawRecords = [
      {
        aiProviderId: mockProviderId,
        aiProviderLabel: 'Provider 1',
        providerTotalCost: 100,
        modelId: mockModelOneId,
        modelLabel: 'Model 1',
        modelTotalCost: 50,
        overallTotalCost: null,
      },
    ];

    (db.$queryRaw as jest.Mock).mockResolvedValue(mockRawRecords);

    await expect(getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange
    )).rejects.toThrow(
      'Error fetching usage records'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching usage records',
      new Error('Total cost was unexpectedly null.')
    );
  });

  it('should log and throw an error if the query fails', async () => {
    const mockError = new Error('Database query failed');
    (db.$queryRaw as jest.Mock).mockRejectedValue(mockError);

    await expect(getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange
    )).rejects.toThrow(
      'Error fetching usage records'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching usage records',
      mockError
    );
  });
});
