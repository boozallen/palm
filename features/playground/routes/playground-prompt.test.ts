import playgroundRoutes from '.';
import { ContextType } from '@/server/trpc-context';
import { PlaygroundService } from '@/features/playground/services/playground';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import logger from '@/server/logger';

jest.mock('features/playground/services/playground.ts');
describe('playgroundPrompt', () => {
  let mockCtx: ContextType;
  beforeEach(() => {
    mockCtx = {
      ai: jest.fn(),
      userId: '6de3d2d5-1918-4288-993a-7445a2c8dbf9',
    } as unknown as ContextType;
  });
  it('should initialize', async () => {
    PlaygroundService.prototype.playgroundPrompt = jest.fn().mockResolvedValue({
      text: 'hello',
      inputTokensUsed: 10,
      outputTokensUsed: 10,
    });

    const mockinput = {
      exampleInput: 'Hello',
      config: {
        randomness: 1,
        model: 'GPT-4',
        repetitiveness: 0.12,
        bestOf: 300,
        frequencyPenalty: null,
        presencePenalty: null,
      },
    };

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.playgroundPrompt([mockinput]);

    expect(result).toBeTruthy();
  });

  it('should return a response when call is successful', async () => {
    PlaygroundService.prototype.playgroundPrompt = jest.fn().mockResolvedValue({
      text: 'hello',
      inputTokensUsed: 10,
      outputTokensUsed: 10,
    });
    const mockinput = {
      exampleInput: 'Hello',
      config: {
        randomness: 1,
        model: 'GPT-4',
        repetitiveness: 0.12,
        bestOf: 300,
        frequencyPenalty: null,
        presencePenalty: null,
      },
    };

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.playgroundPrompt([mockinput]);
    for (const item of result.aiResponse) {
      expect(item.text).toBe('hello');
      expect(item.inputTokensUsed).toBe(10);
    }
  });

  it('should handle any error', async () => {
    PlaygroundService.prototype.playgroundPrompt = jest
      .fn()
      .mockRejectedValue(new Error('Error'));
    const mockinput = {
      exampleInput: 'Hello',
      config: {
        randomness: 1,
        model: 'GPT-4',
        repetitiveness: 0.12,
        bestOf: 300,
        frequencyPenalty: null,
        presencePenalty: null,
      },
    };

    const caller = playgroundRoutes.createCaller(mockCtx);
    try {
      await caller.playgroundPrompt([mockinput]);
    } catch (error: any) {
      expect(error.message).toBe(promptSubmissionErrorMessage);
      expect(logger.error).toHaveBeenCalled();
    }
  });
});
