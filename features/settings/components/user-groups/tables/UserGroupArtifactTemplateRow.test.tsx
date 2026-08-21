import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupArtifactTemplates from '@/features/settings/api/user-groups/update-user-group-artifact-templates';
import UserGroupArtifactTemplateRow from './UserGroupArtifactTemplateRow';

jest.mock('@/features/settings/api/user-groups/update-user-group-artifact-templates');
jest.mock('@mantine/notifications');

const mutateAsync = jest.fn();

const mockTemplate = {
  id: '00000000-0000-0000-0000-000000000001',
  filename: 'sample-template.pptx',
};
const mockUserGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

const TableBodyWrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);

describe('UserGroupArtifactTemplateRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateUserGroupArtifactTemplates as jest.Mock).mockReturnValue({
      mutateAsync,
      error: null,
    });
  });

  it('renders the row with the template filename', () => {
    render(
      <TableBodyWrapper>
        <UserGroupArtifactTemplateRow
          template={mockTemplate}
          userGroupId={mockUserGroupId}
          isEnabled={false}
        />
      </TableBodyWrapper>,
    );

    expect(screen.getByTestId(`${mockTemplate.id}-user-group-artifact-template-row`)).toBeInTheDocument();
    expect(screen.getByText('sample-template.pptx')).toBeInTheDocument();
  });

  it('renders the switch as checked when isEnabled is true', () => {
    render(
      <TableBodyWrapper>
        <UserGroupArtifactTemplateRow
          template={mockTemplate}
          userGroupId={mockUserGroupId}
          isEnabled={true}
        />
      </TableBodyWrapper>,
    );

    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('renders the switch as unchecked when isEnabled is false', () => {
    render(
      <TableBodyWrapper>
        <UserGroupArtifactTemplateRow
          template={mockTemplate}
          userGroupId={mockUserGroupId}
          isEnabled={false}
        />
      </TableBodyWrapper>,
    );

    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('calls mutateAsync with correct args when toggled', async () => {
    render(
      <TableBodyWrapper>
        <UserGroupArtifactTemplateRow
          template={mockTemplate}
          userGroupId={mockUserGroupId}
          isEnabled={false}
        />
      </TableBodyWrapper>,
    );

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        templateId: mockTemplate.id,
        userGroupId: mockUserGroupId,
        enabled: true,
      });
      expect(notifications.show).not.toHaveBeenCalled();
    });
  });

  it('shows an error notification when the update fails', async () => {
    const mockError = new Error('Failed to update');
    (useUpdateUserGroupArtifactTemplates as jest.Mock).mockReturnValue({
      mutateAsync,
      error: mockError,
    });
    mutateAsync.mockRejectedValue(mockError);

    render(
      <TableBodyWrapper>
        <UserGroupArtifactTemplateRow
          template={mockTemplate}
          userGroupId={mockUserGroupId}
          isEnabled={false}
        />
      </TableBodyWrapper>,
    );

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-artifact-templates-failed',
        title: 'Failed to Update',
        message: mockError.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
