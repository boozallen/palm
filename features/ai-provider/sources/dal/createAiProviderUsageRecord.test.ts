import createAiProviderUsageRecord from './createAiProviderUsageRecord';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockModelFindUnique = jest.fn();
const mockAiProvider = jest.fn();
const mockAiProviderUsage = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    model: { findUnique: mockModelFindUnique },
    aiProvider: { findUnique: mockAiProvider },
    aiProviderUsage: { create: mockAiProviderUsage },
  });
});

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('createAiProviderUsageRecord', () => {
  const testInput = {
    userId: 'user-id',
    modelId: 'model-id',
    inputTokensUsed: 100,
    outputTokensUsed: 200,
    system: false,
  };

  const mockUniqueModel = {
    aiProviderId: 'provider-id',
    costPerInputToken: 0.1,
    costPerOutputToken: 0.2,
    aiProvider: {
      costPerInputToken: 0.3,
      costPerOutputToken: 0.4,
    },
  };

  beforeEach(() => {
    mockModelFindUnique.mockResolvedValue(mockUniqueModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates an AI provider usage record', async () => {
    const expectedRecordInput = {
      userId: testInput.userId,
      modelId: testInput.modelId,
      aiProviderId: mockUniqueModel.aiProviderId,
      inputTokensUsed: testInput.inputTokensUsed,
      costPerInputToken: mockUniqueModel.costPerInputToken,
      outputTokensUsed: testInput.outputTokensUsed,
      costPerOutputToken: mockUniqueModel.costPerOutputToken,
      system: false,
    };

    const expectedRecord = {
      id: 'recordid',
      timestamp: 1234,
      ...expectedRecordInput,
    };

    mockAiProviderUsage.mockResolvedValue(expectedRecord);

    const createdRecord = await createAiProviderUsageRecord(testInput);

    expect(mockModelFindUnique).toHaveBeenCalledWith({
      where: { id: testInput.modelId },
      select: {
        aiProviderId: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        aiProvider: {
          select: {
            costPerInputToken: true,
            costPerOutputToken: true,
          },
        },
      },
    });
    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expectedRecordInput,
    });
    expect(createdRecord).toEqual(expectedRecord);
  });

  it('should throw an error if the model is not found', async () => {
    mockModelFindUnique.mockResolvedValue(null);

    await expect(createAiProviderUsageRecord(testInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );

    expect(logger.error).toHaveBeenCalled();
  });
  it('throws an error if there is a problem creating the record', async () => {
    mockAiProviderUsage.mockRejectedValueOnce(new Error('DB error'));

    await expect(createAiProviderUsageRecord(testInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('creates an AI provider usage record', async () => {
    const expectedRecordInput = {
      userId: 'user-id',
      modelId: 'model-id',
      aiProviderId: 'provider-id',
      inputTokensUsed: 100,
      costPerInputToken: 0.1,
      outputTokensUsed: 200,
      costPerOutputToken: 0.2,
      system: false,
    };

    const expectedRecord = {
      id: 'recordid',
      timestamp: 1234,
      ...expectedRecordInput,
    };

    mockAiProviderUsage.mockResolvedValue(expectedRecord);

    const createdRecord = await createAiProviderUsageRecord(testInput);

    expect(mockModelFindUnique).toHaveBeenCalledWith({
      where: { id: testInput.modelId },
      select: {
        aiProviderId: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        aiProvider: {
          select: {
            costPerInputToken: true,
            costPerOutputToken: true,
          },
        },
      },
    });
    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expectedRecordInput,
    });
    expect(createdRecord).toEqual(expectedRecord);
  });

  it('creates an AI provider usage record using provider values when model values are zero', async () => {
    mockModelFindUnique.mockResolvedValue({
      aiProviderId: 'provider-id',
      costPerInputToken: 0,
      costPerOutputToken: 0,
      aiProvider: {
        costPerInputToken: 0.3,
        costPerOutputToken: 0.4,
      },
    });

    const expectedRecordInput = {
      userId: 'user-id',
      modelId: 'model-id',
      aiProviderId: 'provider-id',
      inputTokensUsed: 100,
      costPerInputToken: 0.3,
      outputTokensUsed: 200,
      costPerOutputToken: 0.4,
      system: false,
    };

    const expectedRecord = {
      id: 'recordid',
      timestamp: 1234,
      ...expectedRecordInput,
    };

    mockAiProviderUsage.mockResolvedValue(expectedRecord);

    const createdRecord = await createAiProviderUsageRecord(testInput);

    expect(mockModelFindUnique).toHaveBeenCalledWith({
      where: { id: testInput.modelId },
      select: {
        aiProviderId: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        aiProvider: {
          select: {
            costPerInputToken: true,
            costPerOutputToken: true,
          },
        },
      },
    });
    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expectedRecordInput,
    });
    expect(createdRecord).toEqual(expectedRecord);
  });

  it('should throw an error if the model is not found', async () => {
    mockModelFindUnique.mockResolvedValue(null);

    await expect(createAiProviderUsageRecord(testInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );

    expect(logger.error).toHaveBeenCalled();
  });
  it('throws an error if there is a problem creating the record', async () => {
    mockAiProviderUsage.mockRejectedValueOnce(new Error('DB error'));

    await expect(createAiProviderUsageRecord(testInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
