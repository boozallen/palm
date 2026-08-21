import { render, screen } from '@testing-library/react';
import { JSX } from 'react';
import AgentProvidersTableBody from './AgentProvidersTableBody';

jest.mock('./AgentProviderRow', () => {
  return jest.fn(() => <tr data-testid='agent-provider-row'><td>Agent Provider Row</td></tr>);
});

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('AgentProvidersTableBody', () => {
  const mockProviders = [
    {
      id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
      name: 'Agent One',
      description: 'First agent',
      endpoint: 'https://agent-one.example.com',
    },
    {
      id: 'b9cb9ced-ab50-4534-9444-710112b7e178',
      name: 'Agent Two',
      description: 'Second agent',
      endpoint: 'https://agent-two.example.com',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a row for each agent provider', () => {
    render(
      <TableWrapper>
        <AgentProvidersTableBody agentProviders={mockProviders} />
      </TableWrapper>
    );

    const rows = screen.getAllByTestId('agent-provider-row');
    expect(rows.length).toBe(mockProviders.length);
  });

  it('renders no rows when the list is empty', () => {
    render(
      <TableWrapper>
        <AgentProvidersTableBody agentProviders={[]} />
      </TableWrapper>
    );

    expect(screen.queryByTestId('agent-provider-row')).not.toBeInTheDocument();
  });
});
