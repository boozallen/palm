import { AiProviderUsageTracker } from './AiProviderUsageTracker';
import { AiRepository, AiResponse } from './types';
import createAiProviderUsageRecord from './dal/createAiProviderUsageRecord';
import logger from '@/server/logger';

jest.mock('@prisma/client');
jest.mock('./dal/createAiProviderUsageRecord');
jest.mock('@/server/logger');

const mockCreateAiProviderUsageRecord = createAiProviderUsageRecord as jest.Mock;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('AiProviderUsageTracker', () => {
  let aiRepositoryMock: jest.Mocked<AiRepository>;
  let usageTracker: AiProviderUsageTracker<AiRepository>;

  beforeEach(() => {
    aiRepositoryMock = {
      completion: jest.fn(),
      chatCompletion: jest.fn(),
      createEmbeddings: jest.fn(),
    } as jest.Mocked<AiRepository>;

    usageTracker = new AiProviderUsageTracker(aiRepositoryMock, 'userId', 'modelId', false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute the _run function and create a usage record', async () => {
    const mockResponse: AiResponse = {
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    };

    const fn = jest.fn().mockResolvedValue(mockResponse);

    const result = await usageTracker['_run'](fn);

    expect(fn).toHaveBeenCalled();
    expect(result).toBe(mockResponse);
    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith({
      userId: 'userId',
      modelId: 'modelId',
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      system: false,
    });
  });

  it('should log an error and throw if creating usage record fails', async () => {
    const mockResponse: AiResponse = {
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    };

    const fn = jest.fn().mockResolvedValue(mockResponse);
    mockCreateAiProviderUsageRecord.mockRejectedValue(new Error('DB error'));

    await expect(usageTracker['_run'](fn)).rejects.toThrow('Unable to track AI provider usage');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
