import db from '@/server/db';
import logger from '@/server/logger';
import getAuditRecords from './getAuditRecords';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

jest.mock('@/server/db', () => ({
  auditRecord: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

const ARTIFACT_ID = '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62';
const CHAT_ID = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';

const query = {
  event: undefined,
  outcome: undefined,
  search: undefined,
  page: 1,
  pageSize: 20,
};

const record = (metadata: unknown) => ({
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  event: AuditRecordEvent.DownloadArtifact,
  outcome: AuditRecordOutcome.Success,
  description: 'Downloaded chat artifact.',
  referer: 'http://localhost:3000/chat',
  timestamp: new Date('2026-07-27T00:00:00.000Z'),
  user: { name: 'Test User', email: 'test@example.com' },
  metadata,
});

describe('getAuditRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.auditRecord.count as jest.Mock).mockResolvedValue(1);
  });

  it('returns parsed metadata for records that have it', async () => {
    const metadata = {
      resourceType: AuditRecordResourceType.ChatArtifact,
      resourceIds: [ARTIFACT_ID],
      filenames: ['report.docx'],
      chatId: CHAT_ID,
    };
    (db.auditRecord.findMany as jest.Mock).mockResolvedValueOnce([record(metadata)]);

    const result = await getAuditRecords(query);

    expect(result.records[0].metadata).toEqual(metadata);
  });

  it('returns null metadata for records written before the column existed', async () => {
    (db.auditRecord.findMany as jest.Mock).mockResolvedValueOnce([record(null)]);

    const result = await getAuditRecords(query);

    expect(result.records[0].metadata).toBeNull();
  });

  it('drops malformed metadata rather than failing the whole page', async () => {
    // Metadata is free-form JSON at the database level, so a row written by an
    // older or buggy caller must not break the audit records view.
    (db.auditRecord.findMany as jest.Mock).mockResolvedValueOnce([
      record({ resourceType: 'NOT_A_RESOURCE_TYPE', resourceIds: 'not-an-array' }),
    ]);

    const result = await getAuditRecords(query);

    expect(result.records[0].metadata).toBeNull();
    expect(result.records[0].description).toBe('Downloaded chat artifact.');
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.auditRecord.findMany as jest.Mock).mockRejectedValueOnce(new Error('connection refused'));

    await expect(getAuditRecords(query)).rejects.toThrow('Unable to retrieve audit records');
    expect(logger.error).toHaveBeenCalled();
  });
});
