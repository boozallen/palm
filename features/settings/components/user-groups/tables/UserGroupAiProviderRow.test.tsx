import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupAiProviders from '@/features/settings/api/update-user-group-ai-providers';
import UserGroupAiProviderRow from './UserGroupAiProviderRow';

jest.mock('@/features/settings/api/update-user-group-ai-providers');
jest.mock('@mantine/notifications');

const updateUserGroupAiProviders = jest.fn();

type UserGroupAiProviderRowProps = Readonly<{
  aiProvider: {
    id: string;
    label: string;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

const TableBodyWrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>
      {children}
    </tbody>
  </table>
);

const renderComponent = (props: UserGroupAiProviderRowProps) => {
  render(
    <TableBodyWrapper>
      <UserGroupAiProviderRow {...props} />
    </TableBodyWrapper>
  );
};

describe('UserGroupAiProviderRow', () => {

  let mockAiProvider: {
    id: string,
    label: string,
  };
  let mockUserGroupId: string;
  let mockIsEnabled: boolean;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAiProvider = {
      id: 'd991cc5c-4710-474e-ad8d-57e8627c4fa7',
      label: 'AI Provider',
    };
    mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
    mockIsEnabled = false;

    (useUpdateUserGroupAiProviders as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupAiProviders,
      isPending: false,
      error: null,
    });
  });

  it('renders the AI provider row as enabled', () => {
    mockIsEnabled = true;
    renderComponent({ aiProvider: mockAiProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });

    const row = screen.getByTestId(`${mockAiProvider.id}-user-group-ai-provider-row`);
    expect(row).toBeInTheDocument();

    const name = screen.getByText(mockAiProvider.label);
    expect(name).toBeInTheDocument();

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).toBeChecked();
  });

  it('renders the AI provider row as disabled', () => {
    renderComponent({ aiProvider: mockAiProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();
  });

  it('calls updateUserGroupAiProviders when toggling a Switch', async () => {
    renderComponent({ aiProvider: mockAiProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();

    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupAiProviders).toBeCalledWith({ userGroupId: mockUserGroupId, aiProviderId: mockAiProvider.id, enabled: !mockIsEnabled });
      expect(notifications.show).not.toHaveBeenCalled();
    });
  });

  it('shows a notification toast if updateUserGroupAiProviders fails', async () => {
    const mockError = new Error('Failed to update user group ai providers');
    (useUpdateUserGroupAiProviders as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupAiProviders,
      isPending: false,
      error: mockError,
    });
    updateUserGroupAiProviders.mockRejectedValue(mockError);

    renderComponent({ aiProvider: mockAiProvider, userGroupId: mockUserGroupId, isEnabled: mockIsEnabled });

    const switchComponent = screen.getByRole('switch');
    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupAiProviders).toBeCalledWith({ userGroupId: mockUserGroupId, aiProviderId: mockAiProvider.id, enabled: !mockIsEnabled });
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-ai-providers-failed',
        title: 'Failed to Update',
        message:
          mockError?.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

});
