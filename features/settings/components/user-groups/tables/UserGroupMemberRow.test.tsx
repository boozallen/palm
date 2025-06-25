import { fireEvent, render, screen } from '@testing-library/react';
import UserGroupMemberRow from './UserGroupMemberRow';
import {
  UserGroupMembership,
  UserGroupRole,
} from '@/features/shared/types/user-group';
import { useDisclosure } from '@mantine/hooks';
import { SessionProvider } from 'next-auth/react';
import { UserRole } from '@/features/shared/types/user';

jest.mock(
  '@/features/settings/components/user-groups/modals/DeleteUserGroupMemberModal',
  () => {
    return function MockedDeleteUserGroupMemberModal() {
      return (
        <tr>
          <td>Mocked Delete User Group Member Modal</td>
        </tr>
      );
    };
  }
);

jest.mock('@mantine/hooks');

jest.mock('@mantine/core', () => ({
  ...jest.requireActual('@mantine/core'),
  Select: jest.fn(() => null),
}));

jest.mock('@/features/settings/api/update-user-group-member-role', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn(() => Promise.resolve({ role: 'Lead' })),
    error: null,
  })),
}));

const TableBodyWrapper = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);

const mockUserGroupMember: UserGroupMembership = {
  userGroupId: '1',
  userId: '1',
  name: 'John Doe',
  role: 'Lead' as UserGroupRole,
  email: 'doej@domain.com',
};

const mockOpenModal = jest.fn();

const renderWithSession = (role: UserRole) => {
  const session = {
    expires: '1',
    user: {
      id: '1',
      role: role,
    },
  };
  render(
    <SessionProvider session={session}>
      <TableBodyWrapper>
        <UserGroupMemberRow userGroupMember={mockUserGroupMember} />
      </TableBodyWrapper>
    </SessionProvider>
  );
};

describe('UserGroupMemberRow with Admin user', () => {
  beforeEach(() => {
    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: mockOpenModal, close: jest.fn() },
    ]);
  });

  it('renders user group row', () => {
    renderWithSession(UserRole.Admin);
    const row = screen.getByTestId(
      `${mockUserGroupMember.userId}-user-group-member-row`
    );
    expect(row).toBeInTheDocument();
  });

  it('displays the correct name', () => {
    renderWithSession(UserRole.Admin);
    const name = screen.getByText(mockUserGroupMember.name);
    expect(name).toBeInTheDocument();
  });

  it('displays the correct email', () => {
    renderWithSession(UserRole.Admin);
    const email = screen.getByText(mockUserGroupMember.email as string);
    expect(email).toBeInTheDocument();
  });

  it('opens the DeleteUserGroupModal when the trash can icon is clicked', () => {
    renderWithSession(UserRole.Admin);
    const deleteButton = screen.getByTestId(
      `${mockUserGroupMember.userId}-delete`
    );
    fireEvent.click(deleteButton);
    expect(deleteButton).toBeInTheDocument();
  });

  it('hides the trashcan remove member icon if user is not an admin but is a lead', () => {
    renderWithSession(UserRole.User);
    const deleteButton = screen.queryByTestId(
      `${mockUserGroupMember.userId}-delete`
    );
    expect(deleteButton).not.toBeInTheDocument();
  });
});
