import { render, screen } from '@testing-library/react';
import { useForm } from '@mantine/form';

import { ContextStudioQuery, TimeRange } from '@/features/context-studio/types/context-studio';
import useGetUserGroups from '@/features/context-studio/api/get-user-groups';
import UserGroupInput from './UserGroupInput';

jest.mock('@/features/context-studio/api/get-user-groups');

describe('UserGroupInput', () => {
  const mockGroups = [
    { id: '3f6b1c1e-0000-4000-8000-000000000001', label: 'Default' },
    { id: '3f6b1c1e-0000-4000-8000-000000000002', label: 'Data & Analytics' },
  ];

  const UserGroupInputWrapper = () => {
    const form = useForm<ContextStudioQuery>({
      initialValues: {
        timeRange: TimeRange.Month,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      },
    });

    return <UserGroupInput form={form} />;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useGetUserGroups as jest.Mock).mockReturnValue({ data: { userGroups: mockGroups } });
  });

  it('renders the user group select', () => {
    render(<UserGroupInputWrapper />);

    expect(screen.getByTestId('context-studio-user-group-input')).toBeInTheDocument();
  });

  // The studio's own lookup, not the Settings one, which is gated to Admins and
  // group Leads and so returned nothing for the members the studio grant admits.
  it('reads its options from the studio group lookup', () => {
    render(<UserGroupInputWrapper />);

    expect(useGetUserGroups).toHaveBeenCalled();
    expect(screen.getByTestId('context-studio-user-group-input')).toBeEnabled();
  });

  it('is disabled when no groups come back', () => {
    (useGetUserGroups as jest.Mock).mockReturnValue({ data: { userGroups: [] } });

    render(<UserGroupInputWrapper />);

    expect(screen.getByTestId('context-studio-user-group-input')).toBeDisabled();
  });
});
