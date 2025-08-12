import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import UserGroupKbProviderRow from './UserGroupKbProviderRow';
import { useUpdateUserGroupKbProviders } from '@/features/settings/api/update-user-group-kb-providers';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/settings/api/update-user-group-kb-providers');
jest.mock('@mantine/notifications');

const updateUserGroupKbProviders = jest.fn();

type KbProvider = {
  id: string;
  label: string;
  updatedAt: Date;
};

type UserGroupKbProviderRowProps = Readonly<{
  kbProvider: KbProvider;
  userGroupId: string
  isEnabled: boolean
}>;

const TableBodyWrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>
      {children}
    </tbody>
  </table>
);

describe('UserGroupKbProviderRow', () => {
  let mockKbProvider: {
    id: string,
    label: string,
    updatedAt: Date;
  };
  let mockUserGroupId: string;
  let mockIsEnabled: boolean;

  const renderComponent = (props: UserGroupKbProviderRowProps) => {
    render(
      <TableBodyWrapper>
        <UserGroupKbProviderRow {...props} />
      </TableBodyWrapper>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockKbProvider = {
      id: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
      label: 'New Hires',
      updatedAt: new Date('2021-06-11T14:00:00Z'),
    };

    mockUserGroupId = 'a8cccffc-b523-4219-a242-71ecec71dcc6';

    mockIsEnabled = false;

    (useUpdateUserGroupKbProviders as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupKbProviders,
      isPending: false,
      error: null,
    });
  });

  it('should render label', () => {
    renderComponent({ kbProvider: mockKbProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });
    const label = screen.getByText(mockKbProvider.label);

    expect(label).toBeInTheDocument();
  });

  it('should not have switch enabled if prop is false', async () => {
    renderComponent({ kbProvider: mockKbProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });
    const switchComponent = screen.getByRole('switch');

    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();
  });

  it('should have switch enabled if prop is true', async () => {
    mockIsEnabled = true;
    renderComponent({ kbProvider: mockKbProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });
    const switchComponent = screen.getByRole('switch');

    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).toBeChecked();
  });

  it('should call updateUserGroupKbProviders when switch is toggled', async () => {
    renderComponent({ kbProvider: mockKbProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();

    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupKbProviders).toBeCalledWith({
        userGroupId: mockUserGroupId,
        kbProviderId: mockKbProvider.id,
        enabled: !mockIsEnabled,
      });
      expect(notifications.show).not.toHaveBeenCalled();
    });
  });

  it('should display notification if updateUserGroupKbProviders fails', async () => {
    const mockError = new Error('Failed to update user group kb providers');
    (useUpdateUserGroupKbProviders as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupKbProviders,
      isPending: false,
      error: mockError,
    });

    updateUserGroupKbProviders.mockRejectedValue(mockError);

    renderComponent({ kbProvider: mockKbProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();

    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupKbProviders).toBeCalledWith({
        userGroupId: mockUserGroupId, kbProviderId: mockKbProvider.id, enabled: !mockIsEnabled,
      });
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-kb-providers-failed',
        title: 'Failed to Update User Group',
        message:
          mockError?.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
