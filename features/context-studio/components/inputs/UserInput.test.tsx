import { render, screen } from '@testing-library/react';
import { useForm } from '@mantine/form';

import { ContextStudioQuery, TimeRange } from '@/features/context-studio/types/context-studio';
import useGetUserGroupMembers from '@/features/context-studio/api/get-user-group-members';
import UserInput from './UserInput';

jest.mock('@/features/context-studio/api/get-user-group-members');

describe('UserInput', () => {
  const groupId = '3f6b1c1e-0000-4000-8000-000000000001';
  const mockMembers = [
    { userId: '7c5a5f3c-14e9-4a23-b307-4bf4ddcfda84', name: 'Test User' },
  ];

  const UserInputWrapper = ({ userGroupId }: { userGroupId: string }) => {
    const form = useForm<ContextStudioQuery>({
      initialValues: {
        timeRange: TimeRange.Month,
        userGroupId,
        userId: 'all',
        excludeAdmins: false,
      },
    });

    return <UserInput form={form} />;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useGetUserGroupMembers as jest.Mock).mockReturnValue({ data: { members: mockMembers }, isLoading: false });
  });

  it('renders the user select', () => {
    render(<UserInputWrapper userGroupId={groupId} />);

    expect(screen.getByTestId('context-studio-user-input')).toBeInTheDocument();
  });

  // The studio's own lookup, not the Settings one, which is gated to Leads of the
  // requested group and so returned nothing for anyone else.
  it('reads its options from the studio member lookup', () => {
    render(<UserInputWrapper userGroupId={groupId} />);

    expect(useGetUserGroupMembers).toHaveBeenCalledWith(groupId, true);
    expect(screen.getByTestId('context-studio-user-input')).toBeEnabled();
  });

  // Options are that group's members, so there is nothing to offer until a group
  // is chosen.
  it('does not query while the group filter is on all groups', () => {
    render(<UserInputWrapper userGroupId='all' />);

    expect(useGetUserGroupMembers).toHaveBeenCalledWith('all', false);
    expect(screen.getByTestId('context-studio-user-input')).toBeDisabled();
  });

  it('shows its own placeholder when no group is chosen', () => {
    render(<UserInputWrapper userGroupId='all' />);

    expect(screen.getByTestId('context-studio-user-input')).toHaveAttribute('placeholder', 'Select a user');
  });

  it('prompts for a user once a group is chosen', () => {
    render(<UserInputWrapper userGroupId={groupId} />);

    expect(screen.getByTestId('context-studio-user-input')).toHaveAttribute('placeholder', 'Select user');
  });

  // Guards against the fetch-in-flight state being mistaken for "no members".
  it('shows a loading placeholder instead of "no users" while members are in flight', () => {
    (useGetUserGroupMembers as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    render(<UserInputWrapper userGroupId={groupId} />);

    const input = screen.getByTestId('context-studio-user-input');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Loading...');
  });
});
