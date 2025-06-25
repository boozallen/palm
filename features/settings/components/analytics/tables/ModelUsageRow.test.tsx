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
  };

  it('should render label and cost', () => {
    render(
      <TableWrapper>
        <ModelUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByText('Model Label')).toBeInTheDocument();
    expect(screen.getByText('$123.46')).toBeInTheDocument();
  });

  it('correctly formats cost', () => {
    props.cost = 123.45678;
    render(
      <TableWrapper>
        <ModelUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByText('$123.46')).toBeInTheDocument();
  });

  it('correctly formats costs under $0.01', () => {
    props.cost = 0.005;
    render(
      <TableWrapper>
        <ModelUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByText('<$0.01')).toBeInTheDocument();
  });
});
