import { render } from '@testing-library/react';
import DatabasesTable from './DatabasesTable';

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn().mockReturnValue({ mutate: jest.fn() }),
}));

describe('DatabasesTable', () => {
  it('should render the DatabasesTable component', () => {
    const { container } = render(<DatabasesTable />);

    expect(container).toBeTruthy();
  });

  it('should render table with correct test id', () => {
    const { getByTestId } = render(<DatabasesTable />);

    const table = getByTestId('databases-table');

    expect(table).toBeInTheDocument();
  });

  it('should render table headers with correct text', () => {
    const { getByText } = render(<DatabasesTable />);

    expect(getByText('Database')).toBeInTheDocument();
    expect(getByText('Type')).toBeInTheDocument();
    expect(getByText('Description')).toBeInTheDocument();
  });

  it('should render PostgreSQL link in table body', () => {
    const { getByText } = render(<DatabasesTable />);

    const postgresLink = getByText('PostgreSQL');

    expect(postgresLink).toBeInTheDocument();
  });

  it('should render PostgreSQL link with correct href', () => {
    const { getByText } = render(<DatabasesTable />);

    const postgresLink = getByText('PostgreSQL');
    const linkElement = postgresLink.closest('a');

    expect(linkElement).toHaveAttribute('href', '/settings/databases/postgres');
  });

  it('should render Neo4j link in table body', () => {
    const { getByText } = render(<DatabasesTable />);

    const neo4jLink = getByText('Neo4j');

    expect(neo4jLink).toBeInTheDocument();
  });

  it('should render Neo4j link with correct href', () => {
    const { getByText } = render(<DatabasesTable />);

    const neo4jLink = getByText('Neo4j');
    const linkElement = neo4jLink.closest('a');

    expect(linkElement).toHaveAttribute('href', '/settings/databases/neo4j');
  });

  it('should render database type for PostgreSQL', () => {
    const { getByText } = render(<DatabasesTable />);

    expect(getByText('Relational')).toBeInTheDocument();
  });

  it('should render database type for Neo4j', () => {
    const { getByText } = render(<DatabasesTable />);

    expect(getByText('Graph')).toBeInTheDocument();
  });

  it('should have correct table structure', () => {
    const { container } = render(<DatabasesTable />);

    const thead = container.querySelector('thead');
    const tbody = container.querySelector('tbody');
    const th = container.querySelector('th');
    const td = container.querySelector('td');

    expect(thead).toBeInTheDocument();
    expect(tbody).toBeInTheDocument();
    expect(th).toBeInTheDocument();
    expect(td).toBeInTheDocument();
  });

  it('should render table wrapper with styling', () => {
    const { container } = render(<DatabasesTable />);

    const tableWrapper = container.firstChild;
    expect(tableWrapper).toBeInTheDocument();
  });

  it('should render two database rows', () => {
    const { container } = render(<DatabasesTable />);

    const tbody = container.querySelector('tbody');
    const rows = tbody?.querySelectorAll('tr');

    expect(rows).toHaveLength(2);
  });
});
