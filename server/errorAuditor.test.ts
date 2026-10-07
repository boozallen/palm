import { Prisma } from '@prisma/client';

import { ErrorAuditor, ErrorAuditorOptions, ErrorAuditorDetails } from './errorAuditor';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  errorRecord: {
    create: jest.fn(),
  },
}));

describe('ErrorAuditor', () => {
  const errorAuditorOptions: ErrorAuditorOptions = {
    userId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  };

  let errorAuditor: ErrorAuditor;

  beforeEach(() => {
    jest.clearAllMocks();
    errorAuditor = new ErrorAuditor(errorAuditorOptions);
  });

  it('should initialize with correct properties', () => {
    expect(errorAuditor).toBeInstanceOf(ErrorAuditor);
    expect(errorAuditor['userId']).toBe(errorAuditorOptions.userId);
  });

  it('should create an Error Record with the bound userId', async () => {
    const details: ErrorAuditorDetails = {
      source: 'trpc',
      route: 'settings.getUsersListWithRole',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
      stack: 'Error: Something went wrong\n    at handler',
    };
    (db.errorRecord.create as jest.Mock).mockResolvedValueOnce({ id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c' });

    await errorAuditor.createErrorRecord(details);

    expect(db.errorRecord.create).toHaveBeenCalledWith({
      data: {
        userId: errorAuditorOptions.userId,
        source: details.source,
        route: details.route,
        code: details.code,
        message: details.message,
        stack: details.stack,
        metadata: Prisma.DbNull,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should persist metadata when provided', async () => {
    const details: ErrorAuditorDetails = {
      source: 'trpc',
      route: 'settings.getUsersListWithRole',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
      metadata: { type: 'query' },
    };
    (db.errorRecord.create as jest.Mock).mockResolvedValueOnce({ id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c' });

    await errorAuditor.createErrorRecord(details);

    expect(db.errorRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: details.metadata }),
      }),
    );
  });

  it('should log rather than throw if the create query fails', async () => {
    const details: ErrorAuditorDetails = {
      source: 'trpc',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    };
    const mockError = new Error('ErrorRecord creation failed.');
    (db.errorRecord.create as jest.Mock).mockRejectedValueOnce(mockError);

    await expect(errorAuditor.createErrorRecord(details)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith('Error creating Error Record', mockError);
  });
});
