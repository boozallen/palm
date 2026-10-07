import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import savePulseResult from './savePulseResult';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseResult: { create: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCreate = db.agentPulseResult.create as jest.Mock;

const params = {
  jobId: 'job-1',
  rowNumber: 2,
  responseText: 'What did you like?:\nThe advice column',
  cells: [{ header: 'What did you like?', value: 'The advice column' }],
  sortOrder: 0,
  values: [
    { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null },
    { fieldName: 'Takeaway', value: 'Neutral', wasDefaulted: true, failureReason: 'Value was empty' },
  ],
};

describe('savePulseResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'result-1' });
  });

  it('writes the row and its derived values together', async () => {
    await savePulseResult(params);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        jobId: 'job-1',
        rowNumber: 2,
        responseText: 'What did you like?:\nThe advice column',
        cells: [{ header: 'What did you like?', value: 'The advice column' }],
        sortOrder: 0,
        values: {
          create: [
            { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false },
            { fieldName: 'Takeaway', value: 'Neutral', wasDefaulted: true },
          ],
        },
      },
      select: { id: true },
    });
  });

  it('treats a row that is already stored as done rather than failing the run', async () => {
    mockCreate.mockRejectedValue(new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
    }));

    await expect(savePulseResult(params)).resolves.toBeUndefined();
  });

  it('throws a descriptive error when the write fails', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    await expect(savePulseResult(params)).rejects.toThrow('Failed to save PULSE result');
  });

  it('throws when the write fails for a reason other than the row already existing', async () => {
    mockCreate.mockRejectedValue(new PrismaClientKnownRequestError('Timed out', {
      code: 'P2024',
      clientVersion: '6.0.0',
    }));

    await expect(savePulseResult(params)).rejects.toThrow('Failed to save PULSE result');
  });
});
