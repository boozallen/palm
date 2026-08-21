import { render, screen } from '@testing-library/react';

import UserUsageRow from './UserUsageRow';

function TableWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <table>
      <tbody>
        {children}
      </tbody>
    </table>
  );
}

describe('UserUsageRow', () => {
  const props = {
    name: 'John Doe',
    cost: 123.4560,
    inputTokens: 1000000,
    outputTokens: 500000,
  };

  it('should render name and cost', () => {
    render(
      <TableWrapper>
        <UserUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('user-cost')).toHaveTextContent('$123.46');
    expect(screen.getByTestId('user-input-tokens')).toBeInTheDocument();
    expect(screen.getByTestId('user-output-tokens')).toBeInTheDocument();
  });

  it('correctly formats cost', () => {
    props.cost = 123.45678;
    render(
      <TableWrapper>
        <UserUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('user-cost')).toHaveTextContent('$123.46');
  });

  it('correctly formats costs under $0.01', () => {
    props.cost = 0.005;
    render(
      <TableWrapper>
        <UserUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('user-cost')).toHaveTextContent('<$0.01');
  });

  it('correctly formats input tokens', () => {
    render(
      <TableWrapper>
        <UserUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('user-input-tokens')).toHaveTextContent('1.0M');
  });

  it('correctly formats output tokens', () => {
    render(
      <TableWrapper>
        <UserUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByTestId('user-output-tokens')).toHaveTextContent('500.0K');
  });
});
