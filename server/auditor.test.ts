import { Auditor, AuditorOptions, AuditorDetails } from './auditor';
import db from '@/server/db';
import logger from '@/server/logger';

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
      outcome: 'SUCCESS',
      description: 'Description for event that took place.',
      event: 'CREATE_USER', // Add the event property
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
      outcome: 'ERROR',
      description: 'Description for event that took place.',
      event: 'USER_SIGN_IN',
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
      outcome: 'INFO',
      description: 'Description for event that took place.',
      event: 'USER_SIGN_OUT',
    };
    const mockError = new Error('AuditRecord creation failed.');
    (db.auditRecord.create as jest.Mock).mockRejectedValueOnce(mockError);

    await auditor.createAuditRecord(auditorDetails);

    expect(db.auditRecord.create).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Event audited', { ...auditorOptions, ...auditorDetails });
    expect(logger.error).toHaveBeenCalledWith('Error creating Audit Record', mockError);
    expect(logger.debug).toHaveBeenCalledWith({ ...auditorOptions, ...auditorDetails });
  });
});
