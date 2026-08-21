import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostgresPage from '@/pages/settings/databases/postgres';

jest.mock('@/features/settings/components/databases/components/PostgresQueryInterface', () => {
  return function PostgresQueryInterface() {
    return <div data-testid='postgres-query-interface'>PostgreSQL Query Interface</div>;
  };
});

jest.mock('@/components/elements/Breadcrumbs', () => {
  return function Breadcrumbs({ links }: { links: Array<{ title: string; href: string | null }> }) {
    return (
      <div data-testid='breadcrumbs'>
        {links.map((link, index) => (
          <span key={index}>{link.title}</span>
        ))}
      </div>
    );
  };
});

describe('PostgresPage', () => {
  it('should render the PostgresPage component', () => {
    const { container } = render(<PostgresPage />);

    expect(container).toBeTruthy();
  });

  it('should render page title', () => {
    render(<PostgresPage />);

    expect(screen.getByText('PostgreSQL Database')).toBeInTheDocument();
  });

  it('should render page description', () => {
    render(<PostgresPage />);

    expect(screen.getByText('Execute read-only queries on the database')).toBeInTheDocument();
  });

  it('should render breadcrumbs', () => {
    const { getByTestId } = render(<PostgresPage />);

    const breadcrumbs = getByTestId('breadcrumbs');
    expect(breadcrumbs).toBeInTheDocument();
    expect(breadcrumbs).toHaveTextContent('Settings');
    expect(breadcrumbs).toHaveTextContent('Databases');
    expect(breadcrumbs).toHaveTextContent('PostgreSQL');
  });

  it('should render PostgresQueryInterface component', () => {
    const { getByTestId } = render(<PostgresPage />);

    const queryInterface = getByTestId('postgres-query-interface');
    expect(queryInterface).toBeInTheDocument();
  });
});
