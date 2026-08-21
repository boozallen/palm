import { render } from '@testing-library/react';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import JoinUserGroupDialogTable from '@/features/settings/components/system-configurations/tables/JoinUserGroupDialogTable';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@/features/shared/api/get-system-config');

describe('JoinUserGroupDialogTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        joinUserGroupDialogExternalLink: 'https://example.com/get-access',
      },
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<JoinUserGroupDialogTable />);
    expect(queryByText('Join User Group Dialog')).toBeInTheDocument();
  });

  it('should render table body', () => {
    const { queryByTestId } = render(<JoinUserGroupDialogTable />);
    expect(queryByTestId('join-user-group-dialog-config-row')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      isPending: true,
    });

    const { queryByTestId } = render(<JoinUserGroupDialogTable />);
    expect(queryByTestId('join-user-group-dialog-config-row')).not.toBeInTheDocument();
  });

  it('should render error message', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      error: new Error('Error getting System Config'),
    });

    const { queryByText } = render(<JoinUserGroupDialogTable />);
    expect(queryByText('Error getting System Config')).toBeInTheDocument();
  });
});
