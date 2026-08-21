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
});
