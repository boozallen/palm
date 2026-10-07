import getPulseValueDistributions from './getPulseValueDistributions';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseResultValue: { groupBy: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGroupBy = db.agentPulseResultValue.groupBy as jest.Mock;

const countable = ['Sentiment', 'Reading Frequency'];

describe('getPulseValueDistributions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupBy.mockResolvedValue([
      { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, _count: { _all: 80 } },
      { fieldName: 'Sentiment', value: 'Negative', wasDefaulted: false, _count: { _all: 40 } },
      {
        fieldName: 'Reading Frequency',
        value: 'Every Month',
        wasDefaulted: false,
        _count: { _all: 120 },
      },
    ]);
  });

  it('counts each value once per field in a single query', async () => {
    const distributions = await getPulseValueDistributions('job-1', countable);

    expect(mockGroupBy).toHaveBeenCalledTimes(1);
    expect(distributions).toEqual([
      {
        fieldName: 'Sentiment',
        counts: [
          { value: 'Positive', count: 80, defaultedCount: 0 },
          { value: 'Negative', count: 40, defaultedCount: 0 },
        ],
      },
      {
        fieldName: 'Reading Frequency',
        counts: [{ value: 'Every Month', count: 120, defaultedCount: 0 }],
      },
    ]);
  });

  it('reports how many of a value are fallbacks rather than answers', async () => {
    mockGroupBy.mockResolvedValue([
      { fieldName: 'Sentiment', value: 'Neutral', wasDefaulted: false, _count: { _all: 30 } },
      { fieldName: 'Sentiment', value: 'Neutral', wasDefaulted: true, _count: { _all: 40 } },
    ]);

    const distributions = await getPulseValueDistributions('job-1', countable);

    expect(distributions).toEqual([
      {
        fieldName: 'Sentiment',
        counts: [{ value: 'Neutral', count: 70, defaultedCount: 40 }],
      },
    ]);
  });

  it('scopes the counts to one job and to the countable fields', async () => {
    await getPulseValueDistributions('job-1', countable);

    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['fieldName', 'value', 'wasDefaulted'],
        where: { fieldName: { in: countable }, result: { jobId: 'job-1' } },
      }),
    );
  });

  it('counts nothing when no field is countable', async () => {
    await expect(getPulseValueDistributions('job-1', [])).resolves.toEqual([]);
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it('returns nothing for a job with no results', async () => {
    mockGroupBy.mockResolvedValue([]);

    await expect(getPulseValueDistributions('job-1', countable)).resolves.toEqual([]);
  });

  it('throws a descriptive error when the read fails', async () => {
    mockGroupBy.mockRejectedValue(new Error('db down'));

    await expect(getPulseValueDistributions('job-1', countable)).rejects.toThrow(
      'Failed to load PULSE value distributions',
    );
  });
});
