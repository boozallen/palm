import { render, screen } from '@testing-library/react';
import UserGroupsAsLeadTableHead from './UserGroupsAsLeadTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement }>) {
  return <table>{children}</table>;
}

describe('UserGroupsAsLeadTableHead', () => {
  it('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupsAsLeadTableHead />
      </TableWrapper>
    );
    expect(screen.getByTestId('user-groups-as-lead-table-head')).toBeInTheDocument();
  });
});
