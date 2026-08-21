import { render, screen } from '@testing-library/react';
import AgentProvidersTableHead from './AgentProvidersTableHead';

function TableWrapper({
  children,
}: Readonly<{ children: React.ReactElement }>) {
  return <table>{children}</table>;
}

describe('AgentProvidersTableHead', () => {
  afterEach(jest.resetAllMocks);

  it('renders all column headers', () => {
    render(
      <TableWrapper>
        <AgentProvidersTableHead />
      </TableWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
