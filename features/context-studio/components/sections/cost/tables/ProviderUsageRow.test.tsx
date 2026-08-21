import { render, screen } from '@testing-library/react';

import ProviderUsageRow from './ProviderUsageRow';

function TableWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <table>
      <tbody>
        {children}
      </tbody>
    </table>
  );
}

describe('ProviderUsageRow', () => {
  const props = {
    label: 'Provider Label',
    cost: 123.456,
    inputTokens: 2000000,
    outputTokens: 1000000,
  };

  it('should render label and cost', () => {
    render(
      <TableWrapper>
        <ProviderUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('provider-label')).toHaveTextContent('Provider Label');
    expect(screen.getByTestId('provider-cost')).toHaveTextContent('$123.46');
    expect(screen.getByTestId('provider-input-tokens')).toBeInTheDocument();
    expect(screen.getByTestId('provider-output-tokens')).toBeInTheDocument();
  });

  it('correctly formats cost', () => {
    props.cost = 123.45678;
    render(
      <TableWrapper>
        <ProviderUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('provider-cost')).toHaveTextContent('$123.46');
  });

  it('correctly formats costs under $0.01', () => {
    props.cost = 0.005;
    render(
      <TableWrapper>
        <ProviderUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('provider-cost')).toHaveTextContent('<$0.01');
  });
});
