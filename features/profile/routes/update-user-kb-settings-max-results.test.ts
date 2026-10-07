import updateUserKbSettingsMaxResults from '@/features/profile/dal/updateUserKbSettingsMaxResults';
import profileRouter from '@/features/profile/routes';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/profile/dal/updateUserKbSettingsMaxResults');

describe('update-user-kb-settings-max-results route', () => {
  const mockInput = { knowledgeBasesMaxResults: 15 };
  const mockOutput = { knowledgeBasesMaxResults: 15 };

  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockError = Unauthorized('You do not have permission to access this resource');
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('updates the max results setting', async () => {
    (updateUserKbSettingsMaxResults as jest.Mock).mockResolvedValue(mockOutput);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMaxResults(mockInput)).resolves.toEqual(mockOutput);

    expect(updateUserKbSettingsMaxResults).toHaveBeenCalledWith(mockUserId, mockInput.knowledgeBasesMaxResults);
  });

  it('throws unauthorized error without userId', async () => {
    ctx = { userId: null } as unknown as ContextType;

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMaxResults(mockInput)).rejects.toThrow(mockError);

    expect(updateUserKbSettingsMaxResults).not.toHaveBeenCalled();
  });

  it('handles null value', async () => {
    const nullInput = { knowledgeBasesMaxResults: null };
    const nullOutput = { knowledgeBasesMaxResults: null };

    (updateUserKbSettingsMaxResults as jest.Mock).mockResolvedValue(nullOutput);

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMaxResults(nullInput)).resolves.toEqual(nullOutput);

    expect(updateUserKbSettingsMaxResults).toHaveBeenCalledWith(mockUserId, null);
  });

  it('does not allow value greater than 20', async () => {
    const invalidInput = { knowledgeBasesMaxResults: 21 };

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMaxResults(invalidInput)).rejects.toThrow();

    expect(updateUserKbSettingsMaxResults).not.toHaveBeenCalled();
  });

  it('does not allow value less than 1', async () => {
    const invalidInput = { knowledgeBasesMaxResults: 0 };

    const caller = profileRouter.createCaller(ctx);
    await expect(caller.updateUserKbSettingsMaxResults(invalidInput)).rejects.toThrow();

    expect(updateUserKbSettingsMaxResults).not.toHaveBeenCalled();
  });
});
