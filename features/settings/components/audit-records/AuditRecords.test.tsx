import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AuditRecords from './AuditRecords';
import useGetAuditRecords from '@/features/settings/api/audit-records/get-audit-records';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResult,
} from '@/features/shared/types/audit-record';

jest.mock('@/features/settings/api/audit-records/get-audit-records');

jest.mock('./AuditRecordsTable', () => {
  return function MockedAuditRecordsTable() {
    return <div data-testid='audit-records-table' />;
  };
});

const record = (): AuditRecordResult => ({
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  userName: 'Test User',
  userEmail: 'test@example.com',
  event: AuditRecordEvent.DownloadArtifact,
  outcome: AuditRecordOutcome.Success,
  description: 'Downloaded chat artifact.',
  referer: 'http://localhost:3000/chat',
  timestamp: new Date('2026-07-27T12:00:00.000Z'),
  metadata: null,
});

const mockQuery = (records: AuditRecordResult[] | undefined) => {
  (useGetAuditRecords as jest.Mock).mockReturnValue({
    data: records ? { records, totalCount: records.length } : undefined,
    isFetching: false,
    refetch: jest.fn(),
    error: null,
  });
};

describe('AuditRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('labels the clear and download controls for assistive tech, since they show icons only', () => {
    mockQuery([record()]);

    render(<AuditRecords />);

    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download report' })).toBeInTheDocument();
    // The Search button keeps its text — it is the row's primary action.
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('disables download until the table has rows to export', () => {
    mockQuery(undefined);

    render(<AuditRecords />);

    expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled();
  });

  it('disables download when a search returned no rows', () => {
    mockQuery([]);

    render(<AuditRecords />);

    expect(screen.getByRole('button', { name: 'Download report' })).toBeDisabled();
  });

  it('enables download once rows are displayed', () => {
    mockQuery([record()]);

    render(<AuditRecords />);

    expect(screen.getByRole('button', { name: 'Download report' })).toBeEnabled();
  });

  it('disables clear until a filter has been entered', async () => {
    mockQuery(undefined);

    render(<AuditRecords />);

    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Search'), 'download');

    expect(clear).toBeEnabled();
  });
});
