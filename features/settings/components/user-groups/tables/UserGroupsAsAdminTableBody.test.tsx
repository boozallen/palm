import { render, screen } from '@testing-library/react';
import UserGroupsAsAdminTableBody from './UserGroupsAsAdminTableBody';
import { JSX } from 'react';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupAsAdminRow', () => {
  return function MockedUserGroupAsAdminRow() {
    return <tr><td>Mocked User Group As Admin Row</td></tr>;
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
      memberCount: 5,
    },
    {
      id: '2',
      label: 'User Group 2',
      createdAt: new Date(),
      updatedAt: new Date(),
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

});
