import { ContextType } from '@/server/trpc-context';
import libraryRouter from '@/features/library/routes';
import deletePrompt from '@/features/library/dal/deletePrompt';
import { Forbidden, InternalServerError } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import getPrompt from '@/features/library/dal/getPrompt';
import logger from '@/server/logger';

jest.mock('@/features/library/dal/deletePrompt');
jest.mock('@/features/library/dal/getPrompt');

describe('deletePrompt', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

  const mockInput = 'ec4dd2cf-c867-4a81-b940-d22d98544a0d';

  const ctx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockDeletePromptReturn = {
    id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0d',
  };

  const mockGetPromptReturn = {
    id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0d',
    prompt: 'abc',
    creatorId: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
    tags: ['Test'],
    description: 'test',
    example: 'test',
    config: {
      presencePenalty: 0,
      repetitiveness: 0,
      bestOf: 0,
      frequencyPenalty: 0,
      randomness: 0,
      model: 'GPT-3.5',
    },
    summary: 'Test',
    title: 'Test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete prompt if user is an Admin', async () => {
    (deletePrompt as jest.Mock).mockResolvedValue(mockDeletePromptReturn);

    (getPrompt as jest.Mock).mockResolvedValue(mockGetPromptReturn);

    const caller = libraryRouter.createCaller(ctx);
    await expect(caller.deletePrompt({ promptId: mockInput })).resolves.toEqual(
      mockDeletePromptReturn
    );

    expect(getPrompt).toBeCalledWith(mockInput);
    expect(deletePrompt).toBeCalledWith(mockInput);
  });

  it('should throw error if there are no values', async () => {
    (deletePrompt as jest.Mock).mockRejectedValueOnce(
      InternalServerError('Error deleting prompt')
    );

    const caller = libraryRouter.createCaller(ctx);
    await expect(caller.deletePrompt({ promptId: mockInput })).rejects.toThrow(
      new Error('Error deleting prompt')
    );

    expect(deletePrompt).toBeCalledWith(mockInput);
  });

  it('should delete prompt if user is the owner', async () => {
    const ctxUser = {
      userId: mockUserId,
      userRole: UserRole.User,
    } as unknown as ContextType;

    (deletePrompt as jest.Mock).mockResolvedValue(mockDeletePromptReturn);

    (getPrompt as jest.Mock).mockReturnValue(mockGetPromptReturn);

    const caller = libraryRouter.createCaller(ctxUser);
    await expect(caller.deletePrompt({ promptId: mockInput })).resolves.toEqual(
      mockDeletePromptReturn
    );

    expect(getPrompt).toBeCalledWith(mockInput);
    expect(deletePrompt).toBeCalledWith(mockInput);
  });

  it('should throw error if user is not admin and not the owner', async () => {
    const ctxNonAdminNonOwner = {
      userId: '854ae8ac-4ce1-4a89-b2c0-599626d05ac2',
      userRole: UserRole.User,
    } as unknown as ContextType;

    (getPrompt as jest.Mock).mockResolvedValue(mockGetPromptReturn);

    const caller = libraryRouter.createCaller(ctxNonAdminNonOwner);
    await expect(caller.deletePrompt({ promptId: mockInput })).rejects.toThrow(
      Forbidden('You do not have permission to delete this prompt')
    );
    expect(logger.error).toHaveBeenCalled();

    expect(getPrompt).toBeCalledWith(mockInput);
    expect(deletePrompt).not.toBeCalled();
  });
});
