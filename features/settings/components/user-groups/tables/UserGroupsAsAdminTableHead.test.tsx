import { render, screen } from '@testing-library/react';
import UserGroupsAsAdminTableHead from './UserGroupsAsAdminTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement }>) {
  return <table>{children}</table>;
}

describe('UserGroupsAsAdminTableHead', () => {
  test('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupsAsAdminTableHead />
      </TableWrapper>
    );
    expect(screen.getByText('User Group')).toBeInTheDocument();
  });

  test('does not render a role column by default', () => {
    render(
      <TableWrapper>
        <UserGroupsAsAdminTableHead />
      </TableWrapper>
    );
    expect(
      screen.queryByTestId('selected-user-role-header')
    ).not.toBeInTheDocument();
  });

  test('renders a role column when a user is selected', () => {
    render(
      <TableWrapper>
        <UserGroupsAsAdminTableHead showSelectedUserRole />
      </TableWrapper>
    );
    expect(
      screen.getByTestId('selected-user-role-header')
    ).toHaveTextContent('Role in Group');
  });
});
