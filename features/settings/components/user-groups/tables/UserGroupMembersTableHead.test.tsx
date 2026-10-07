import { render, screen } from '@testing-library/react';
import UserGroupMembersTableHead from './UserGroupMembersTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement }>) {
  return <table>{children}</table>;
}

describe('UserGroupTableHead', () => {
  test('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupMembersTableHead />
      </TableWrapper>
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-members-total-spend-header')).toHaveTextContent('Total spend');
    expect(screen.getByTestId('user-group-members-monthly-spend-header')).toHaveTextContent('This month');
    expect(screen.getByText('Role')).toBeInTheDocument();
  });
});
