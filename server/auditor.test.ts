import { Prisma } from '@prisma/client';

import { Auditor, AuditorOptions, AuditorDetails } from './auditor';
import db from '@/server/db';
import logger from '@/server/logger';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

jest.mock('@/server/db', () => ({
  auditRecord: {
    create: jest.fn(),
  },
}));

describe('Auditor', () => {
  const auditorOptions: AuditorOptions = {
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    referer: 'http://localhost:3000/settings',
  };

  let auditor: Auditor;

  beforeEach(() => {
    jest.clearAllMocks();
    auditor = new Auditor(auditorOptions);
  });

  it('should initialize with correct properties', () => {
    expect(auditor).toBeInstanceOf(Auditor);
    expect(auditor['userId']).toBe(auditorOptions.userId);
    expect(auditor['referer']).toBe(auditorOptions.referer);
  });

  it('should log the created Audit Record with SUCCESS outcome', async () => {
    const auditorDetails: AuditorDetails = {
      outcome: AuditRecordOutcome.Success,
      description: 'Description for event that took place.',
      event: AuditRecordEvent.CreateUser,
    };
    const mockResolvedValue = {
      id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
      ...auditorOptions,
      ...auditorDetails,
      timestamp: new Date(),
    };
    (db.auditRecord.create as jest.Mock).mockResolvedValueOnce(mockResolvedValue);

    await auditor.createAuditRecord(auditorDetails);

    expect(db.auditRecord.create).toHaveBeenCalledWith({
      data: {
        ...auditorOptions,
        ...auditorDetails,
        metadata: Prisma.DbNull,
      },
      select: {
        id: true,
      },
    });
    expect(logger.info).toHaveBeenCalledWith('Event audited', { ...auditorOptions, ...auditorDetails });
    expect(logger.info).toHaveBeenCalledWith(`Successfully created new Audit Record. ID: ${mockResolvedValue.id}.`);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('should log the created Audit Record with ERROR outcome', async () => {
    const auditorDetails: AuditorDetails = {
      outcome: AuditRecordOutcome.Error,
      description: 'Description for event that took place.',
      event: AuditRecordEvent.UserSignIn,
    };
    const mockResolvedValue = {
      id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
      ...auditorOptions,
      ...auditorDetails,
      timestamp: new Date(),
    };
    (db.auditRecord.create as jest.Mock).mockResolvedValueOnce(mockResolvedValue);

    await auditor.createAuditRecord(auditorDetails);

    expect(db.auditRecord.create).toHaveBeenCalledWith({
      data: {
        ...auditorOptions,
        ...auditorDetails,
        metadata: Prisma.DbNull,
      },
      select: {
        id: true,
      },
    });
    expect(logger.info).toHaveBeenCalledWith('Event audited', { ...auditorOptions, ...auditorDetails });
    expect(logger.info).toHaveBeenCalledWith(`Successfully created new Audit Record. ID: ${mockResolvedValue.id}.`);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('should log an error and the audit if the create query fails', async () => {
    const auditorDetails: AuditorDetails = {
      outcome: AuditRecordOutcome.Info,
      description: 'Description for event that took place.',
      event: AuditRecordEvent.UserSignOut,
    };
    const mockError = new Error('AuditRecord creation failed.');
    (db.auditRecord.create as jest.Mock).mockRejectedValueOnce(mockError);

    await auditor.createAuditRecord(auditorDetails);

    expect(db.auditRecord.create).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Event audited', { ...auditorOptions, ...auditorDetails });
    expect(logger.error).toHaveBeenCalledWith('Error creating Audit Record', mockError);
    expect(logger.debug).toHaveBeenCalledWith({ ...auditorOptions, ...auditorDetails });
  });

  it('should persist resource metadata when provided', async () => {
    const metadata = {
      resourceType: AuditRecordResourceType.ChatArtifact,
      resourceIds: ['0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62'],
      filenames: ['report.docx'],
      chatId: 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6',
    };
    const auditorDetails: AuditorDetails = {
      outcome: AuditRecordOutcome.Success,
      description: 'Downloaded chat artifact.',
      event: AuditRecordEvent.DownloadArtifact,
      metadata,
    };
    (db.auditRecord.create as jest.Mock).mockResolvedValueOnce({ id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c' });

    await auditor.createAuditRecord(auditorDetails);

    expect(db.auditRecord.create).toHaveBeenCalledWith({
      data: {
        ...auditorOptions,
        outcome: auditorDetails.outcome,
        description: auditorDetails.description,
        event: auditorDetails.event,
        metadata,
      },
      select: {
        id: true,
      },
    });
  });

  it('should write a SQL NULL rather than a JSON null when metadata is absent', async () => {
    const auditorDetails: AuditorDetails = {
      outcome: AuditRecordOutcome.Info,
      description: 'Description for event that took place.',
      event: AuditRecordEvent.UserSignOut,
      metadata: null,
    };
    (db.auditRecord.create as jest.Mock).mockResolvedValueOnce({ id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c' });

    await auditor.createAuditRecord(auditorDetails);

    expect(db.auditRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: Prisma.DbNull }),
      }),
    );
  });
});
