import { render, screen } from '@testing-library/react';
import UserGroupsAsLeadTableBody from './UserGroupsAsLeadTableBody';
import { JSX } from 'react';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupAsLeadRow', () => {
  return function MockedUserGroupRow() {
    return <tr><td>Mocked User Group Row</td></tr>;
  };
});

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('UserGroupsAsLeadTableBody', () => {

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
        <UserGroupsAsLeadTableBody userGroups={mockUserGroups} />
      </TableWrapper>
    );

    const tableBody = screen.getByTestId('user-groups-as-lead-table-body');
    expect(tableBody).toBeInTheDocument();
  });

  it('renders correct number of rows', () => {
    render(
      <TableWrapper>
        <UserGroupsAsLeadTableBody userGroups={mockUserGroups} />
      </TableWrapper>
    );

    const rows = screen.getAllByText('Mocked User Group Row');
    expect(rows.length).toBe(mockUserGroups.length);
  });

});
