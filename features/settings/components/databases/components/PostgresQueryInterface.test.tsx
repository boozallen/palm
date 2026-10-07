import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import PostgresQueryInterface from './PostgresQueryInterface';
import useExecuteQuery from '@/features/settings/api/databases/execute-query';

// Mock the execute query hook
jest.mock('@/features/settings/api/databases/execute-query');

// Mock Mantine notifications
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

// Mock Mantine components
jest.mock('@mantine/core', () => ({
  Stack: ({ children, ...props }: any) => <div data-testid='stack' {...props}>{children}</div>,
  Paper: ({ children, ...props }: any) => <div data-testid='paper' {...props}>{children}</div>,
  Group: ({ children, position, ...props }: any) => <div data-testid='group' data-position={position} {...props}>{children}</div>,
  Title: ({ children, order, ...props }: any) => <h1 data-testid='title' data-order={order} {...props}>{children}</h1>,
  Badge: ({ children, ...props }: any) => <span data-testid='badge' {...props}>{children}</span>,
  Alert: ({ children, ...props }: any) => <div data-testid='alert' {...props}>{children}</div>,
  Textarea: ({ value, onChange, placeholder, ...props }: any) => (
    <textarea
      data-testid='query-textarea'
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  ),
  Button: ({ children, onClick, loading, ...props }: any) => (
    <button
      data-testid='execute-button'
      onClick={onClick}
      disabled={loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
  Text: ({ children, ...props }: any) => <span data-testid='text' {...props}>{children}</span>,
  Table: ({ children, ...props }: any) => <table data-testid='results-table' {...props}>{children}</table>,
  ScrollArea: ({ children, ...props }: any) => <div data-testid='scroll-area' {...props}>{children}</div>,
  Box: ({ children, style, ...props }: any) => <div data-testid='box' style={style} {...props}>{children}</div>,
}));

// Mock Tabler icons
jest.mock('@tabler/icons-react', () => ({
  IconDatabase: () => <span data-testid='icon-database'>DB Icon</span>,
  IconAlertCircle: () => <span data-testid='icon-alert'>Alert Icon</span>,
}));

describe('PostgresQueryInterface', () => {
  const mockMutateAsync = jest.fn();
  const mockExecuteQuery = {
    mutateAsync: mockMutateAsync,
    isPending: false,
    data: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useExecuteQuery as jest.Mock).mockReturnValue(mockExecuteQuery);
  });

  describe('rendering', () => {
    it('should render query editor with placeholder', () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', 'SELECT * FROM "User" LIMIT 10;');
    });

    it('should render execute button', () => {
      render(<PostgresQueryInterface />);

      const button = screen.getByTestId('execute-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Execute Query');
    });

    it('should display read-only badge', () => {
      render(<PostgresQueryInterface />);

      const badge = screen.getByTestId('badge');
      expect(badge).toBeInTheDocument();
    });

    it('should display informational alert', () => {
      render(<PostgresQueryInterface />);

      const alert = screen.getByTestId('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('query validation', () => {
    it('should reject empty query', async () => {
      render(<PostgresQueryInterface />);

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Please enter a query',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject non-SELECT queries', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'UPDATE "User" SET name = "test"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Only SELECT queries are allowed',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject INSERT queries', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'INSERT INTO "User" VALUES (1, "test")' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Only SELECT queries are allowed',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject DELETE queries', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'DELETE FROM "User" WHERE id = 1' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Only SELECT queries are allowed',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject DROP queries', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'DROP TABLE "User"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Only SELECT queries are allowed',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject CREATE queries', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'CREATE TABLE test (id INT)' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Only SELECT queries are allowed',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject ALTER queries', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'ALTER TABLE "User" ADD COLUMN test TEXT' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Only SELECT queries are allowed',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should reject SELECT query containing disallowed keywords', async () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SELECT * FROM "User"; DROP TABLE "User"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invalid Query',
          message: 'Query contains disallowed keyword: DROP. Only SELECT queries are permitted.',
          color: 'red',
        });
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should accept valid SELECT query', async () => {
      mockMutateAsync.mockResolvedValue({
        columns: ['id', 'name'],
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        executionTime: 100,
      });

      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SELECT * FROM "User"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({ query: 'SELECT * FROM "User"' });
      });
    });

    it('should handle case-insensitive validation', async () => {
      mockMutateAsync.mockResolvedValue({
        columns: ['id'],
        rows: [],
        rowCount: 0,
        executionTime: 50,
      });

      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SeLeCt * FrOm "User"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
    });
  });

  describe('query execution', () => {
    it('should execute valid query and show success notification', async () => {
      const mockResult = {
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
        rowCount: 2,
        executionTime: 150,
      };

      mockMutateAsync.mockResolvedValue(mockResult);

      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SELECT * FROM "User" LIMIT 2' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Success',
          message: 'Query executed successfully',
          color: 'green',
        });
      });

      expect(mockMutateAsync).toHaveBeenCalledWith({ query: 'SELECT * FROM "User" LIMIT 2' });
    });

    it('should show error notification when query fails', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Database connection failed'));

      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SELECT * FROM "User"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Database connection failed',
          color: 'red',
        });
      });
    });

    it('should disable button while query is executing', () => {
      (useExecuteQuery as jest.Mock).mockReturnValue({
        ...mockExecuteQuery,
        isPending: true,
      });

      render(<PostgresQueryInterface />);

      const button = screen.getByTestId('execute-button');
      expect(button).toBeDisabled();
    });
  });

  describe('results display', () => {
    it('should display query results in table format', () => {
      const mockResult = {
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
        rowCount: 2,
        executionTime: 150,
      };

      (useExecuteQuery as jest.Mock).mockReturnValue({
        ...mockExecuteQuery,
        data: mockResult,
      });

      render(<PostgresQueryInterface />);

      const table = screen.getByTestId('results-table');
      expect(table).toBeInTheDocument();
    });

    it('should display execution time and row count', () => {
      const mockResult = {
        columns: ['id'],
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: 3,
        executionTime: 250,
      };

      (useExecuteQuery as jest.Mock).mockReturnValue({
        ...mockExecuteQuery,
        data: mockResult,
      });

      render(<PostgresQueryInterface />);

      expect(screen.getByText('3 rows returned in 250ms')).toBeInTheDocument();
    });

    it('should display singular "row" for single result', () => {
      const mockResult = {
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 100,
      };

      (useExecuteQuery as jest.Mock).mockReturnValue({
        ...mockExecuteQuery,
        data: mockResult,
      });

      render(<PostgresQueryInterface />);

      expect(screen.getByText('1 row returned in 100ms')).toBeInTheDocument();
    });

    it('should display message when no results returned', () => {
      const mockResult = {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 50,
      };

      (useExecuteQuery as jest.Mock).mockReturnValue({
        ...mockExecuteQuery,
        data: mockResult,
      });

      render(<PostgresQueryInterface />);

      expect(screen.getByText('Query returned no results')).toBeInTheDocument();
    });

    it('should not display results table initially', () => {
      render(<PostgresQueryInterface />);

      const table = screen.queryByTestId('results-table');
      expect(table).not.toBeInTheDocument();
    });
  });

  describe('query input handling', () => {
    it('should update query state when typing', () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SELECT id FROM "User"' } });

      expect(textarea).toHaveValue('SELECT id FROM "User"');
    });

    it('should handle multiline queries', () => {
      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      const multilineQuery = 'SELECT id,\n  name,\n  email\nFROM "User"\nWHERE id > 10';
      fireEvent.change(textarea, { target: { value: multilineQuery } });

      expect(textarea).toHaveValue(multilineQuery);
    });

    it('should trim whitespace before validation', async () => {
      mockMutateAsync.mockResolvedValue({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 50,
      });

      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: '   SELECT * FROM "User"   ' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
    });

    it('should allow queries with column names containing blacklisted keywords', async () => {
      mockMutateAsync.mockResolvedValue({
        columns: ['id', 'createdAt', 'updatedAt'],
        rows: [{ id: 1, createdAt: '2025-01-01', updatedAt: '2025-01-02' }],
        rowCount: 1,
        executionTime: 100,
      });

      render(<PostgresQueryInterface />);

      const textarea = screen.getByTestId('query-textarea');
      fireEvent.change(textarea, { target: { value: 'SELECT id, createdAt, updatedAt FROM "User"' } });

      const button = screen.getByTestId('execute-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({ query: 'SELECT id, createdAt, updatedAt FROM "User"' });
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Success',
        message: 'Query executed successfully',
        color: 'green',
      });
    });
  });
});
