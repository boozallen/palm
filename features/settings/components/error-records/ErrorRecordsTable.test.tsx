import { render, screen } from '@testing-library/react';

import ErrorRecordsTable from './ErrorRecordsTable';
import { ErrorRecordResult } from '@/features/shared/types/error-record';

const record = (overrides: Partial<ErrorRecordResult> = {}): ErrorRecordResult => ({
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  userName: 'Test User',
  userEmail: 'test@example.com',
  source: 'trpc',
  route: 'settings.getUsersListWithRole',
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Something went wrong',
  stack: null,
  timestamp: new Date('2026-07-27T12:00:00.000Z'),
  metadata: null,
  ...overrides,
});

const defaultProps = {
  totalCount: 1,
  currentPage: 1,
  pageSize: 20,
  onPageChange: jest.fn(),
  isLoading: false,
  isSubmitted: true,
};

describe('ErrorRecordsTable', () => {
  it('shows the tRPC route and formatted code for a caught error', () => {
    render(<ErrorRecordsTable {...defaultProps} records={[record()]} />);

    expect(screen.getByText('settings.getUsersListWithRole')).toBeInTheDocument();
    expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
  });

  it('falls back to a system label when no user is attached to the error', () => {
    render(<ErrorRecordsTable {...defaultProps} records={[record({ userName: null, userEmail: null })]} />);

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders a placeholder when there is no stack trace', () => {
    render(<ErrorRecordsTable {...defaultProps} records={[record()]} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('shows an empty state once a search has run with no results', () => {
    render(<ErrorRecordsTable {...defaultProps} records={[]} totalCount={0} />);

    expect(screen.getByText('No error records found')).toBeInTheDocument();
  });
});
