import { render, screen } from '@testing-library/react';
import UserGroupsAsAdminTableBody from './UserGroupsAsAdminTableBody';
import { JSX } from 'react';
import { UserGroup, UserGroupRole } from '@/features/shared/types/user-group';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupAsAdminRow', () => {
  return function MockedUserGroupAsAdminRow({
    userGroup,
    selectedUserRole,
  }: Readonly<{
    userGroup: UserGroup;
    selectedUserRole?: UserGroupRole;
  }>) {
    return (
      <tr>
        <td>Mocked User Group As Admin Row</td>
        <td data-testid={`${userGroup.id}-mocked-role`}>
          {selectedUserRole ?? 'none'}
        </td>
      </tr>
    );
  };
});

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('UserGroupsAsAdminTableBody', () => {

  const mockUserGroups = [
    {
      id: '1',
      label: 'User Group 1',
      createdAt: new Date(),
      updatedAt: new Date(),
      graphDatabaseEnabled: false,
      workflowsEnabled: false,
      agenticChatEnabled: false,
      contextStudioEnabled: false,
      memberCount: 5,
    },
    {
      id: '2',
      label: 'User Group 2',
      createdAt: new Date(),
      updatedAt: new Date(),
      graphDatabaseEnabled: true,
      workflowsEnabled: false,
      agenticChatEnabled: false,
      contextStudioEnabled: false,
      memberCount: 10,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupsAsAdminTableBody userGroups={mockUserGroups} />
      </TableWrapper>
    );

    const tableBody = screen.getByTestId('user-groups-as-admin-table-body');
    expect(tableBody).toBeInTheDocument();
  });

  it('renders correct number of rows', () => {
    render(
      <TableWrapper>
        <UserGroupsAsAdminTableBody userGroups={mockUserGroups} />
      </TableWrapper>
    );

    const rows = screen.getAllByText('Mocked User Group As Admin Row');
    expect(rows.length).toBe(mockUserGroups.length);
  });

  it('gives each row the selected user\'s role for that group', () => {
    render(
      <TableWrapper>
        <UserGroupsAsAdminTableBody
          userGroups={mockUserGroups}
          rolesByUserGroupId={{ '2': UserGroupRole.Lead }}
        />
      </TableWrapper>
    );

    expect(screen.getByTestId('1-mocked-role')).toHaveTextContent('none');
    expect(screen.getByTestId('2-mocked-role')).toHaveTextContent(
      UserGroupRole.Lead
    );
  });

});
