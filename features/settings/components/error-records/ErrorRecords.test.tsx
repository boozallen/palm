import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ErrorRecords from './ErrorRecords';
import useGetErrorRecords from '@/features/settings/api/error-records/get-error-records';
import { ErrorRecordResult } from '@/features/shared/types/error-record';

jest.mock('@/features/settings/api/error-records/get-error-records');

jest.mock('./ErrorRecordsTable', () => {
  return function MockedErrorRecordsTable() {
    return <div data-testid='error-records-table' />;
  };
});

const record = (): ErrorRecordResult => ({
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
});

const mockQuery = (records: ErrorRecordResult[] | undefined) => {
  (useGetErrorRecords as jest.Mock).mockReturnValue({
    data: records ? { records, totalCount: records.length } : undefined,
    isFetching: false,
    refetch: jest.fn(),
    error: null,
  });
};

describe('ErrorRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('labels the clear and download controls for assistive tech, since they show icons only', () => {
    mockQuery([record()]);

    render(<ErrorRecords />);

    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download report' })).toBeInTheDocument();
    // The Search button keeps its text — it is the row's primary action.
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('disables download until the table has rows to export', () => {
    mockQuery(undefined);

    render(<ErrorRecords />);

    expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled();
  });

  it('disables download when a search returned no rows', () => {
    mockQuery([]);

    render(<ErrorRecords />);

    expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled();
  });

  it('enables download once rows are displayed', () => {
    mockQuery([record()]);

    render(<ErrorRecords />);

    expect(screen.getByRole('button', { name: 'Download report' })).toBeEnabled();
  });

  it('disables clear until a filter has been entered', async () => {
    mockQuery(undefined);

    render(<ErrorRecords />);

    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Search'), 'timeout');

    expect(clear).toBeEnabled();
  });
});
