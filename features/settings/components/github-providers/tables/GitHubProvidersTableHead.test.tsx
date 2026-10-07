import { render, screen } from '@testing-library/react';
import GitHubProvidersTableHead from './GitHubProvidersTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement }>) {
  return <table>{children}</table>;
}

describe('GitHubProvidersTableHead', () => {
  afterEach(jest.resetAllMocks);

  it('renders all column headers', () => {
    render(
      <TableWrapper>
        <GitHubProvidersTableHead />
      </TableWrapper>,
    );

    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('API Base URL')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
