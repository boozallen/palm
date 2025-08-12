import { render, screen, fireEvent } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';
import UserGroupAsAdminRow from './UserGroupAsAdminRow';

jest.mock('@/features/settings/components/user-groups/modals/DeleteUserGroupModal', () => {
  return function MockedDeleteUserGroupModal() {
    return <tr><td>Mocked Delete User Group Modal</td></tr>;
  };
});

jest.mock('@mantine/hooks');

const TableBodyWrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>
      {children}
    </tbody>
  </table>
);

describe('UserGroupAsAdminRow', () => {

  const mockUserGroup = {
    id: '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18',
    label: 'Test User Group',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 5,
  };

  const mockOpenModal = jest.fn();

  beforeEach(() => {
    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: mockOpenModal, close: jest.fn() },
    ]);

    render(
      <TableBodyWrapper>
        <UserGroupAsAdminRow userGroup={mockUserGroup} />
      </TableBodyWrapper>
    );
  });

  it('renders without crashing', () => {
    const row = screen.getByTestId(`${mockUserGroup.id}-user-group-as-admin-row`);
    expect(row).toBeInTheDocument();
  });

  it('displays the correct label', () => {
    const label = screen.getByText(mockUserGroup.label);
    expect(label).toBeInTheDocument();
  });

  it('displays the correct member count', () => {
    const memberCount = screen.getByText(mockUserGroup.memberCount.toString());
    expect(memberCount).toBeInTheDocument();
  });

  it('displays the trash icon', () => {
    const deleteButton = screen.getByTestId(`${mockUserGroup.id}-delete`);
    expect(deleteButton).toBeInTheDocument();
  });

  it('opens the DeleteUserGroupModal when the trash can icon is clicked', () => {
    const deleteButton = screen.getByTestId(`${mockUserGroup.id}-delete`);

    fireEvent.click(deleteButton);

    expect(mockOpenModal).toBeCalled();
  });

});
