import { render, screen } from '@testing-library/react';

import ModelUsageRow from './ModelUsageRow';

function TableWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <table>
      <tbody>
        {children}
      </tbody>
    </table>
  );
}

describe('ModelUsageRow', () => {
  const props = {
    label: 'Model Label',
    cost: 123.4560,
    inputTokens: 1000000,
    outputTokens: 500000,
  };

  it('should render label and cost', () => {
    render(
      <TableWrapper>
        <ModelUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('model-label')).toHaveTextContent('Model Label');
    expect(screen.getByTestId('model-cost')).toHaveTextContent('$123.46');
    expect(screen.getByTestId('model-input-tokens')).toBeInTheDocument();
    expect(screen.getByTestId('model-output-tokens')).toBeInTheDocument();
  });

  it('correctly formats cost', () => {
    props.cost = 123.45678;
    render(
      <TableWrapper>
        <ModelUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('model-cost')).toHaveTextContent('$123.46');
  });

  it('correctly formats costs under $0.01', () => {
    props.cost = 0.005;
    render(
      <TableWrapper>
        <ModelUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('model-cost')).toHaveTextContent('<$0.01');
  });
});
