import { render, screen } from '@testing-library/react';
import UserGroupGraphDatabasesTableHead from './UserGroupGraphDatabasesTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement}>) {
  return <table>{children}</table>;
}

describe('UserGroupGraphDatabasesTableHead', () => {
  test('renders without crashing with admin user', () => {
    render(
      <TableWrapper>
        <UserGroupGraphDatabasesTableHead />
      </TableWrapper>
    );
    expect(screen.getByText('Graph Database Feature')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  test('renders without crashing with non-admin user', () => {
    render(
      <TableWrapper>
        <UserGroupGraphDatabasesTableHead />
      </TableWrapper>
    );
    expect(screen.getByText('Graph Database Feature')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });
});