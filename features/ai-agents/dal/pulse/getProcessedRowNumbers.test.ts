import getProcessedRowNumbers from './getProcessedRowNumbers';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseResult: { findMany: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFindMany = db.agentPulseResult.findMany as jest.Mock;

describe('getProcessedRowNumbers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([{ rowNumber: 2 }, { rowNumber: 4 }]);
  });

  it('reports which rows already have results so a retry skips them', async () => {
    await expect(getProcessedRowNumbers('job-1')).resolves.toEqual([2, 4]);
  });

  it('returns an empty list for a fresh job', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(getProcessedRowNumbers('job-1')).resolves.toEqual([]);
  });

  it('throws a descriptive error when the read fails', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));

    await expect(getProcessedRowNumbers('job-1')).rejects.toThrow(
      'Failed to load processed PULSE rows',
    );
  });
});
