import { trpc } from '@/libs';
import useDeleteUserGroupMembership from './delete-user-group-membership';

const mockSetUserGroupMembershipsData = jest.fn();
const mockInvalidateGetUserGroups = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('@/libs', () => ({
  trpc: {
    useContext: jest.fn(),
    settings: {
      deleteUserGroupMembership: {
        useMutation: jest.fn(),
      },
    },
  },
}));

type MutationOptions = {
  onSuccess: (data: { userGroupId: string; userId: string }) => void;
};

const mockDeletedMembership = { userGroupId: 'group-1', userId: 'user-1' };

// The hook's behavior lives entirely in the onSuccess handler it hands to
// useMutation, so capture that handler and invoke it directly. Named as a hook
// because it calls one; every trpc dependency is mocked, so there is no renderer.
const useCapturedOnSuccess = (): MutationOptions['onSuccess'] => {
  useDeleteUserGroupMembership();

  return (mockUseMutation.mock.calls[0][0] as MutationOptions).onSuccess;
};

describe('useDeleteUserGroupMembership', () => {
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

    (trpc.settings.deleteUserGroupMembership.useMutation as unknown as jest.Mock) = mockUseMutation;
  });

  it('removes the deleted membership from the admin-facing group members cache', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess(mockDeletedMembership);

    expect(mockSetUserGroupMembershipsData).toHaveBeenCalledWith(
      { id: mockDeletedMembership.userGroupId },
      expect.any(Function),
    );

    const updater = mockSetUserGroupMembershipsData.mock.calls[0][1];

    expect(updater({ userGroupMemberships: [{ userId: 'user-1' }, { userId: 'user-2' }] })).toEqual({
      userGroupMemberships: [{ userId: 'user-2' }],
    });
  });

  it('leaves the admin-facing group members cache untouched when it has not been populated', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess(mockDeletedMembership);

    const updater = mockSetUserGroupMembershipsData.mock.calls[0][1];

    expect(updater(undefined)).toBeUndefined();
  });

  it('invalidates the current user\'s own group memberships so a self-removal is reflected immediately', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess(mockDeletedMembership);

    expect(mockInvalidateGetUserGroups).toHaveBeenCalledTimes(1);
  });
});
