import { AiProviderUsageTracker } from './AiProviderUsageTracker';
import { AiRepository, AiResponse, StreamEvent } from './types';
import createAiProviderUsageRecord from './dal/createAiProviderUsageRecord';
import logger from '@/server/logger';
import { AiSettings } from '@/types';

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
      agent: false,
      knowledgeGraph: false,
      embedding: false,
    });
  });

  it('should flag embedding runs on the usage record', async () => {
    const tracker = new AiProviderUsageTracker(
      aiRepositoryMock,
      'userId',
      'modelId',
      false,
      false,
      false,
      {},
      true,
    );

    await tracker['_run'](jest.fn().mockResolvedValue({
      inputTokensUsed: 10,
      outputTokensUsed: 0,
      text: '',
    } as AiResponse));

    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: true,
        system: false,
        agent: false,
        knowledgeGraph: false,
      }),
    );
  });

  it('should attach chat message attribution to the usage record', async () => {
    const tracker = new AiProviderUsageTracker(
      aiRepositoryMock,
      'userId',
      'modelId',
      false,
      false,
      false,
      { chatMessageId: 'message-1', stepLabel: 'response' },
    );

    await tracker['_run'](jest.fn().mockResolvedValue({
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    } as AiResponse));

    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        chatMessageId: 'message-1',
        stepLabel: 'response',
      }),
    );
  });

  it('should attach workflow primitive attribution to the usage record', async () => {
    const tracker = new AiProviderUsageTracker(
      aiRepositoryMock,
      'userId',
      'modelId',
      false,
      false,
      false,
      { workflowExecutionId: 'exec-1', primitiveId: 'prompt-1', stepLabel: 'Draft' },
    );

    await tracker['_run'](jest.fn().mockResolvedValue({
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    } as AiResponse));

    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowExecutionId: 'exec-1',
        primitiveId: 'prompt-1',
        stepLabel: 'Draft',
      }),
    );
  });

  it('should attach the selected user group to the usage record', async () => {
    const tracker = new AiProviderUsageTracker(
      aiRepositoryMock,
      'userId',
      'modelId',
      false,
      false,
      false,
      {},
      false,
      'group-1',
    );

    await tracker['_run'](jest.fn().mockResolvedValue({
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    } as AiResponse));

    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'group-1' }),
    );
  });

  it('should attribute tool-use completions as well', async () => {
    aiRepositoryMock.chatCompletionWithTools = jest.fn().mockResolvedValue({
      type: 'text',
      text: '',
      inputTokensUsed: 10,
      outputTokensUsed: 20,
    });

    const tracker = new AiProviderUsageTracker(
      aiRepositoryMock,
      'userId',
      'modelId',
      false,
      true,
      false,
      { chatMessageId: 'message-1', stepLabel: 'search' },
    );

    await tracker.chatCompletionWithTools([], [], {} as AiSettings);

    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        chatMessageId: 'message-1',
        stepLabel: 'search',
        agent: true,
      }),
    );
  });

  it('should attribute streamed tool-use completions on the done event', async () => {
    aiRepositoryMock.streamChatCompletionWithTools = jest.fn(async function* (): AsyncGenerator<StreamEvent> {
      yield {
        type: 'done',
        response: { type: 'text', text: '', inputTokensUsed: 10, outputTokensUsed: 20 },
      };
    });

    const tracker = new AiProviderUsageTracker(
      aiRepositoryMock,
      'userId',
      'modelId',
      false,
      true,
      false,
      { chatMessageId: 'message-1', stepLabel: 'stream' },
    );

    for await (const event of tracker.streamChatCompletionWithTools([], [], {} as AiSettings)) {
      expect(event.type).toBe('done');
    }

    expect(mockCreateAiProviderUsageRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        chatMessageId: 'message-1',
        stepLabel: 'stream',
      }),
    );
  });

  it('should omit attribution fields entirely when there is none', async () => {
    await usageTracker['_run'](jest.fn().mockResolvedValue({
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    } as AiResponse));

    const input = mockCreateAiProviderUsageRecord.mock.calls[0][0];
    expect(input).not.toHaveProperty('chatMessageId');
    expect(input).not.toHaveProperty('workflowExecutionId');
    expect(input).not.toHaveProperty('primitiveId');
    expect(input).not.toHaveProperty('stepLabel');
  });

  it('should log an error and still return the response when creating the usage record fails', async () => {
    const mockResponse: AiResponse = {
      inputTokensUsed: 10,
      outputTokensUsed: 20,
      text: '',
    };

    const fn = jest.fn().mockResolvedValue(mockResponse);
    mockCreateAiProviderUsageRecord.mockRejectedValue(new Error('DB error'));

    await expect(usageTracker['_run'](fn)).resolves.toBe(mockResponse);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
