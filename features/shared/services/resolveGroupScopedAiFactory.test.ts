import { AIFactory } from '@/features/ai-provider';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import resolveGroupScopedAiFactory from '@/features/shared/services/resolveGroupScopedAiFactory';

jest.mock('@/features/shared/dal/isUserGroupMember');

describe('resolveGroupScopedAiFactory', () => {
  const userId = 'user-1';
  const userGroupId = 'group-1';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns an AIFactory scoped to the group when the user is a member', async () => {
    (isUserGroupMember as jest.Mock).mockResolvedValue(true);

    const ai = await resolveGroupScopedAiFactory(userId, userGroupId);

    expect(isUserGroupMember).toHaveBeenCalledWith(userId, userGroupId);
    expect(ai).toBeInstanceOf(AIFactory);
  });

  it('rejects a group the user is not a member of', async () => {
    (isUserGroupMember as jest.Mock).mockResolvedValue(false);

    await expect(resolveGroupScopedAiFactory(userId, userGroupId)).rejects.toThrow(
      'You are not a member of the selected group',
    );
  });

  it('skips membership validation and returns an unscoped AIFactory when no group is given', async () => {
    const ai = await resolveGroupScopedAiFactory(userId, undefined);

    expect(isUserGroupMember).not.toHaveBeenCalled();
    expect(ai).toBeInstanceOf(AIFactory);
  });

  it('skips membership validation and returns an unscoped AIFactory when the group is null', async () => {
    const ai = await resolveGroupScopedAiFactory(userId, null);

    expect(isUserGroupMember).not.toHaveBeenCalled();
    expect(ai).toBeInstanceOf(AIFactory);
  });
});
