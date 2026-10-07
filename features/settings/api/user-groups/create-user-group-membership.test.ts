import { trpc } from '@/libs';
import useCreateUserGroupMembership from './create-user-group-membership';

const mockSetUserGroupMembershipsData = jest.fn();
const mockInvalidateGetUserGroups = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('@/libs', () => ({
  trpc: {
    useContext: jest.fn(),
    settings: {
      createUserGroupMembership: {
        useMutation: jest.fn(),
      },
    },
  },
}));

type MutationOptions = {
  onSuccess: (data: { userGroupId: string; userId: string }) => void;
};

const mockCreatedMembership = { userGroupId: 'group-1', userId: 'user-1' };

// The hook's behavior lives entirely in the onSuccess handler it hands to
// useMutation, so capture that handler and invoke it directly. Named as a hook
// because it calls one; every trpc dependency is mocked, so there is no renderer.
const useCapturedOnSuccess = (): MutationOptions['onSuccess'] => {
  useCreateUserGroupMembership();

  return (mockUseMutation.mock.calls[0][0] as MutationOptions).onSuccess;
};

describe('useCreateUserGroupMembership', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (trpc.useContext as jest.Mock).mockReturnValue({
      settings: {
        getUserGroupMemberships: { setData: mockSetUserGroupMembershipsData },
      },
      profile: {
        getUserGroups: { invalidate: mockInvalidateGetUserGroups },
      },
    });

    (trpc.settings.createUserGroupMembership.useMutation as unknown as jest.Mock) = mockUseMutation;
  });

  it('appends the new membership to the admin-facing group members cache', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess(mockCreatedMembership);

    expect(mockSetUserGroupMembershipsData).toHaveBeenCalledWith(
      { id: mockCreatedMembership.userGroupId },
      expect.any(Function),
    );

    const updater = mockSetUserGroupMembershipsData.mock.calls[0][1];

    expect(updater({ userGroupMemberships: [{ userId: 'existing' }] })).toEqual({
      userGroupMemberships: [
        { userId: 'existing' },
        {
          ...mockCreatedMembership,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          monthlyCost: 0,
          monthlyInputTokens: 0,
          monthlyOutputTokens: 0,
        },
      ],
    });
  });

  it('leaves the admin-facing group members cache untouched when it has not been populated', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess(mockCreatedMembership);

    const updater = mockSetUserGroupMembershipsData.mock.calls[0][1];

    expect(updater(undefined)).toBeUndefined();
  });

  it('invalidates the current user\'s own group memberships so a self-add is reflected immediately', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess(mockCreatedMembership);

    expect(mockInvalidateGetUserGroups).toHaveBeenCalledTimes(1);
  });
});
