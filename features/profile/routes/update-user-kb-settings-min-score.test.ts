import updateUserKbSettingsMinScore from '@/features/profile/dal/updateUserKbSettingsMinScore';
import profileRouter from '@/features/profile/routes';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/profile/dal/updateUserKbSettingsMinScore');

describe('update-user-kb-settings-min-score route', () => {
  const mockInput = { knowledgeBasesMinScore: 0.5 };
  const mockOutput = { knowledgeBasesMinScore: 0.5 };

  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockError = Unauthorized('You do not have permission to access this resource');
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('updates the min score setting', async () => {
    (updateUserKbSettingsMinScore as jest.Mock).mockResolvedValue(mockOutput);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMinScore(mockInput)).resolves.toEqual(mockOutput);

    expect(updateUserKbSettingsMinScore).toHaveBeenCalledWith(mockUserId, mockInput.knowledgeBasesMinScore);
  });

  it('throws unauthorized error without userId', async () => {
    ctx = { userId: null } as unknown as ContextType;

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMinScore(mockInput)).rejects.toThrow(mockError);

    expect(updateUserKbSettingsMinScore).not.toHaveBeenCalled();
  });

  it('handles null value', async () => {
    const nullInput = { knowledgeBasesMinScore: null };
    const nullOutput = { knowledgeBasesMinScore: null };

    (updateUserKbSettingsMinScore as jest.Mock).mockResolvedValue(nullOutput);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMinScore(nullInput)).resolves.toEqual(nullOutput);

    expect(updateUserKbSettingsMinScore).toHaveBeenCalledWith(mockUserId, null);
  });
});
