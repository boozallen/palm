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
  };

  it('should render label and cost', () => {
    render(
      <TableWrapper>
        <ProviderUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByText('Provider Label')).toBeInTheDocument();
    expect(screen.getByText('$123.46')).toBeInTheDocument();
  });

  it('correctly formats cost', () => {
    props.cost = 123.45678;
    render(
      <TableWrapper>
        <ProviderUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByText('$123.46')).toBeInTheDocument();
  });

  it('correctly formats costs under $0.01', () => {
    props.cost = 0.005;
    render(
      <TableWrapper>
        <ProviderUsageRow {...props} />
      </TableWrapper>
    );

    expect(screen.getByText('<$0.01')).toBeInTheDocument();
  });
});
