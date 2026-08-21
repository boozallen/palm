import { render, screen } from '@testing-library/react';
import Databases from './Databases';

// Mock the DatabasesTable component
jest.mock('./tables/DatabasesTable', () => ({
  __esModule: true,
  default: () => <div data-testid='databases-table'>Databases Table</div>,
}));

// Mock Mantine components
jest.mock('@mantine/core', () => ({
  Stack: ({ children, ...props }: any) => <div data-testid='stack' {...props}>{children}</div>,
}));

describe('Databases', () => {
  it('should render Stack container', () => {
    render(<Databases />);

    const stack = screen.getByTestId('stack');
    expect(stack).toBeInTheDocument();
  });

  it('should render DatabasesTable component', () => {
    render(<Databases />);

    const table = screen.getByTestId('databases-table');
    expect(table).toBeInTheDocument();
  });
});
