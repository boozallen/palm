import { render, screen } from '@testing-library/react';
import AiProvidersTableHead from './AiProvidersTableHead';

function TableWrapper({
  children,
}: Readonly<{ children: React.ReactElement }>) {
  return <table>{children}</table>;
}

describe('AiProvidersTableHead', () => {
  afterEach(jest.resetAllMocks);

  it('should render the table head', () => {
    render(
      <TableWrapper>
        <AiProvidersTableHead />
      </TableWrapper>,
    );
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Model Name')).toBeInTheDocument();
    expect(screen.getByText('Model External ID')).toBeInTheDocument();
    expect(screen.getByText('Input Token Cost')).toBeInTheDocument();
    expect(screen.getByText('Output Token Cost')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
