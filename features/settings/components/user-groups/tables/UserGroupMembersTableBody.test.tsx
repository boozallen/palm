import { render, screen } from '@testing-library/react';
import UserGroupMembersTableBody from './UserGroupMembersTableBody';
import { UserGroupRole } from '@/features/shared/types/user-group';
import { JSX } from 'react';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupMemberRow', () => {
  return function MockedUserGroupMemberRow() {
    return <tr><td>Mocked User Group Member Row</td></tr>;
  };
});

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('UserGroupMembersTableBody', () => {

  const mockUserGroupMembers = [
    {
      userId: 'test-id-1',
      userGroupId: 'test-id-1',
      name: 'User Group Member 1',
      role: UserGroupRole.Lead,
      email: 'dsds@gmail.com',
    },
    {
      userId: 'test-id-2',
      userGroupId: 'test-id-2',
      name: 'User Group Member 2',
      role: UserGroupRole.User,
      email: 'dfjs@gmail.com',
    },
    {
      userId: 'test-id-3',
      userGroupId: 'test-id-3',
      name: 'User Group Member 3',
      role: UserGroupRole.User,
      email: 'test3@gmail.com',
    },
    {
      userId: 'test-id-4',
      userGroupId: 'test-id-4',
      name: 'User Group Member 4',
      role: UserGroupRole.Lead,
      email: 'test4@gmail.com',
    },
    {
      userId: 'test-id-5',
      userGroupId: 'test-id-5',
      name: 'User Group Member 5',
      role: UserGroupRole.User,
      email: 'test5@gmail.com',
    },
    {
      userId: 'test-id-6',
      userGroupId: 'test-id-6',
      name: 'User Group Member 6',
      role: UserGroupRole.Lead,
      email: 'test6@gmail.com',
    },
    {
      userId: 'test-id-7',
      userGroupId: 'test-id-7',
      name: 'User Group Member 7',
      role: UserGroupRole.User,
      email: 'test7@gmail.com',
    },
    {
      userId: 'test-id-8',
      userGroupId: 'test-id-8',
      name: 'User Group Member 8',
      role: UserGroupRole.Lead,
      email: 'test8@gmail.com',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupMembersTableBody userGroupMembers={mockUserGroupMembers} />
      </TableWrapper>
    );

    const tableBody = screen.getByTestId('user-group-members-table-body');
    expect(tableBody).toBeInTheDocument();
  });

  it('renders correct number of rows per page', () => {
    render(
      <TableWrapper>
        <UserGroupMembersTableBody userGroupMembers={mockUserGroupMembers} />
      </TableWrapper>
    );

    const rows = screen.getAllByText('Mocked User Group Member Row');
    expect(rows.length).toBe(mockUserGroupMembers.length);
  });

});
