import { render } from '@testing-library/react';
import DefaultUserGroupSelectionTable from './DefaultUserGroupSelectionTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/settings/api/user-groups/get-user-groups', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: { userGroups: [] },
    isPending: false,
    error: null,
  })),
}));

describe('DefaultUserGroupSelectionTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        defaultUserGroupId: '1e0ef4b1-a1c7-42a0-b1fc-ad0d1b9e67dd',
      },
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });

    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: { userGroups: [{ id: '1', label: 'Group 1' }] },
      isPending: false,
      error: null,
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<DefaultUserGroupSelectionTable />);
    expect(queryByText('Default User Group')).toBeInTheDocument();
  });

  it('should render table body', () => {
    const { queryByTestId } = render(<DefaultUserGroupSelectionTable />);
    expect(queryByTestId('default-user-group-config-row')).toBeInTheDocument();
  });
});
