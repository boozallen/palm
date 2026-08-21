import { UserRole } from '@/features/shared/types/user';
import { PromptService } from '@/features/library/services/prompts';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import { TRPCError } from '@trpc/server';

jest.mock('@/features/library/services/prompts');

describe('runPrompt route', () => {
  let mockCtx: ContextType;
  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
  };

  const mockInput = {
    instructions: 'Test prompt instructions',
    config: {
      temperature: 0.7,
      model: 'gpt-4',
      topP: 0.5,
      frequencyPenalty: null,
      presencePenalty: null,
    },
  };

  const mockResponse = {
    text: 'Mock AI response',
    usage: {
      inputTokens: 10,
      outputTokens: 20,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
      ai: {},
      logger: mockLogger,
    } as unknown as ContextType;
  });

  it('should successfully run prompt and return response', async () => {
    const mockRunPrompt = jest.fn().mockResolvedValue(mockResponse);
    (PromptService as jest.Mock).mockImplementation(() => ({
      runPrompt: mockRunPrompt,
    }));

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.runPrompt(mockInput);

    expect(result).toEqual(mockResponse);
    expect(PromptService).toHaveBeenCalledWith(mockCtx.ai);
    expect(mockRunPrompt).toHaveBeenCalledWith(mockInput);
    expect(mockLogger.debug).toHaveBeenCalledWith('promptService.runPrompt: ', mockResponse);
  });

  it('should throw TRPCError when PromptService throws TRPCError', async () => {
    const tRPCError = new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid configuration',
    });

    const mockRunPrompt = jest.fn().mockRejectedValue(tRPCError);
    (PromptService as jest.Mock).mockImplementation(() => ({
      runPrompt: mockRunPrompt,
    }));

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(caller.runPrompt(mockInput)).rejects.toThrow(tRPCError);
    expect(mockLogger.error).toHaveBeenCalledWith('runPrompt.mutation: ', tRPCError);
  });

  it('should throw generic error message when PromptService throws non-TRPCError', async () => {
    const genericError = new Error('Service unavailable');

    const mockRunPrompt = jest.fn().mockRejectedValue(genericError);
    (PromptService as jest.Mock).mockImplementation(() => ({
      runPrompt: mockRunPrompt,
    }));

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(caller.runPrompt(mockInput)).rejects.toThrow(
      'Unable to retrieve response from the AI provider. Please check that your API configuration is correct or try again later.'
    );
    expect(mockLogger.error).toHaveBeenCalledWith('runPrompt.mutation: ', genericError);
  });

  it('should validate input schema - reject empty instructions', async () => {
    const invalidInput = {
      instructions: '',
      config: mockInput.config,
    };

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(caller.runPrompt(invalidInput)).rejects.toThrow();
  });

  it('should validate input schema - reject missing instructions', async () => {
    const invalidInput = {
      config: mockInput.config,
    } as any;

    const caller = sharedRouter.createCaller(mockCtx);

    await expect(caller.runPrompt(invalidInput)).rejects.toThrow();
  });
});