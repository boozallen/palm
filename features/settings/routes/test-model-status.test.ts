import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { Forbidden } from '@/features/shared/errors/routeErrors';

describe('test-model-status', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockModelId = 'd9776d52-42d2-4a5c-9db2-b422478a1f5c';
  const mockAiResponse = 'It worked!';
  const mockExternalId = 'gemini-1.5-flash';

  const mockInput = {
    modelId: mockModelId,
  };

  const mockChatCompletion = jest.fn();
  const mockBuildUserSource = jest.fn();
  const mockBuildSystemSource = jest.fn();

  const systemSourceResponse = {
    source: {
      chatCompletion: mockChatCompletion,
    },
    model: {
      externalId: mockExternalId,
    },
  };

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBuildSystemSource.mockResolvedValue(systemSourceResponse);

    mockBuildUserSource.mockResolvedValue(systemSourceResponse);

    mockChatCompletion.mockResolvedValue({
      text: mockAiResponse,
    });

    ctx = {
      userId: mockUserId,
      userRole: UserRole.Admin,
      ai: {
        buildSystemSource: mockBuildSystemSource,
        buildUserSource: mockBuildUserSource,
      },
      logger: logger,
    } as unknown as ContextType;
  });

  it('allows admin to test a model', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.testModelStatus(mockInput)).resolves.toEqual({
      aiResponse: mockAiResponse,
      isValid: true,
    });

    expect(ctx.ai.buildSystemSource).toBeCalledWith(mockInput.modelId);
    expect(mockChatCompletion).toBeCalled();
  });

  it('does not allow a non-admin user to test model', async () => {
    ctx.userRole = UserRole.User;

    const error = Forbidden(
      'You do not have permission to access this resource.'
    );

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.testModelStatus(mockInput)).rejects.toThrow(error);

    expect(ctx.ai.buildSystemSource).not.toBeCalled();
    expect(ctx.ai.buildUserSource).not.toBeCalled();
    expect(mockChatCompletion).not.toBeCalled();
  });
});
