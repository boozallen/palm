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

jest.mock('@/features/settings/api/user-groups/update-user-group-member-role', () => ({
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
  lastLoginAt: new Date(),
  cost: 12.5,
  inputTokens: 1500,
  outputTokens: 250,
  monthlyCost: 5,
  monthlyInputTokens: 600,
  monthlyOutputTokens: 100,
};

const mockOpenModal = jest.fn();

const renderWithSession = (
  role: UserRole,
  monthlyBudget: number | null | undefined = null,
  userGroupMember: UserGroupMembership = mockUserGroupMember
) => {
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
        <UserGroupMemberRow userGroupMember={userGroupMember} monthlyBudget={monthlyBudget} />
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

  it('displays the correct lastLoginAt', () => {
    renderWithSession(UserRole.Admin);
    const expectedDate = new Date(mockUserGroupMember.lastLoginAt!).toLocaleString(undefined, { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
    });
    const lastLoginAt = screen.getByText(expectedDate);
    expect(lastLoginAt).toBeInTheDocument();
  });

  it('displays the correct total cost and token usage', () => {
    renderWithSession(UserRole.Admin);
    expect(screen.getByTestId('user-group-member-total-usage')).toHaveTextContent('$12.50 · 1.8K tokens');
  });

  it('displays the correct monthly cost and token usage', () => {
    renderWithSession(UserRole.Admin);
    expect(screen.getByTestId('user-group-member-usage')).toHaveTextContent('$5.00 · 700 tokens');
  });

  it('does not flag the member as over budget when no monthly budget is set', () => {
    renderWithSession(UserRole.Admin, null);
    expect(screen.getByTestId('user-group-member-usage')).toBeInTheDocument();
    expect(screen.queryByTestId('user-group-member-usage-over-limit')).not.toBeInTheDocument();
  });

  it('does not flag the member as over budget when their monthly cost is below the monthly budget', () => {
    renderWithSession(UserRole.Admin, 20);
    expect(screen.getByTestId('user-group-member-usage')).toBeInTheDocument();
    expect(screen.queryByTestId('user-group-member-usage-over-limit')).not.toBeInTheDocument();
  });

  it('flags the member as over budget once their monthly cost meets or exceeds the monthly budget', () => {
    renderWithSession(UserRole.Admin, 5);
    expect(screen.getByTestId('user-group-member-usage-over-limit')).toHaveTextContent('$5.00 · 700 tokens');
    expect(screen.queryByTestId('user-group-member-usage')).not.toBeInTheDocument();
  });

  it('does not flag the member as over budget when the monthly budget is 0 and nothing has been spent this month', () => {
    renderWithSession(UserRole.Admin, 0, { ...mockUserGroupMember, monthlyCost: 0 });
    expect(screen.getByTestId('user-group-member-usage')).toBeInTheDocument();
    expect(screen.queryByTestId('user-group-member-usage-over-limit')).not.toBeInTheDocument();
  });

  it('flags the member as over budget when the monthly budget is 0 and any amount has been spent this month', () => {
    renderWithSession(UserRole.Admin, 0);
    expect(screen.getByTestId('user-group-member-usage-over-limit')).toBeInTheDocument();
    expect(screen.queryByTestId('user-group-member-usage')).not.toBeInTheDocument();
  });

  it('opens the DeleteUserGroupModal when the trash can icon is clicked', () => {
    renderWithSession(UserRole.Admin);
    const deleteButton = screen.getByTestId(
      `${mockUserGroupMember.userId}-delete`,
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
