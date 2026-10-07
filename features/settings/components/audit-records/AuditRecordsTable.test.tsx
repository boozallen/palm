import { render, screen } from '@testing-library/react';

import AuditRecordsTable from './AuditRecordsTable';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
  AuditRecordResult,
} from '@/features/shared/types/audit-record';

const ARTIFACT_ID = '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62';
const CHAT_ID = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';

const record = (overrides: Partial<AuditRecordResult> = {}): AuditRecordResult => ({
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  userName: 'Test User',
  userEmail: 'test@example.com',
  event: AuditRecordEvent.DownloadArtifact,
  outcome: AuditRecordOutcome.Success,
  description: 'Downloaded chat artifact.',
  referer: 'http://localhost:3000/chat',
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

describe('AuditRecordsTable', () => {
  it('shows the resource a record acted on', () => {
    const records = [
      record({
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      }),
    ];

    render(<AuditRecordsTable {...defaultProps} records={records} />);

    expect(screen.getByText('Resource')).toBeInTheDocument();
    expect(screen.getByText(`report.docx | ids: ${ARTIFACT_ID}`)).toBeInTheDocument();
  });

  it('falls back to the resource type when there are no filenames or ids', () => {
    const records = [
      record({
        event: AuditRecordEvent.CopyContentToClipboard,
        metadata: { resourceType: AuditRecordResourceType.ChatMessage },
      }),
    ];

    render(<AuditRecordsTable {...defaultProps} records={records} />);

    expect(screen.getByText(AuditRecordResourceType.ChatMessage)).toBeInTheDocument();
  });

  it('renders a placeholder for records with no metadata', () => {
    render(<AuditRecordsTable {...defaultProps} records={[record()]} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
