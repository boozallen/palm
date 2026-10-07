import getPulseResults from './getPulseResults';
import db from '@/server/db';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    agentPulseJob: { findFirst: jest.fn() },
    agentPulseResult: { findMany: jest.fn() },
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockJob = db.agentPulseJob.findFirst as jest.Mock;
const mockResults = db.agentPulseResult.findMany as jest.Mock;

describe('getPulseResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJob.mockResolvedValue({
      id: 'job-1',
      fields: [
        { fieldName: 'Sentiment', fieldType: 'category', sortOrder: 0 },
        { fieldName: 'Takeaway', fieldType: 'freeText', sortOrder: 1 },
      ],
    });
    mockResults.mockResolvedValue([
      {
        id: 'result-1',
        rowNumber: 2,
        responseText: 'What did you like?:\nThe advice column',
        cells: [{ header: 'What did you like?', value: 'The advice column' }],
        sortOrder: 0,
        values: [
          { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false },
          { fieldName: 'Takeaway', value: 'Likes the advice column.', wasDefaulted: false },
        ],
      },
    ]);
  });

  it('returns the derived rows alongside the field columns to render', async () => {
    const data = await getPulseResults('job-1', 'user-1', 'agent-1');

    expect(data.fields).toEqual([
      { fieldName: 'Sentiment', fieldType: PulseFieldType.CATEGORY, sortOrder: 0 },
      { fieldName: 'Takeaway', fieldType: PulseFieldType.FREE_TEXT, sortOrder: 1 },
    ]);
    expect(data.results[0]).toMatchObject({ rowNumber: 2, values: expect.any(Array) });
  });

  it('returns each answer under its own question', async () => {
    const data = await getPulseResults('job-1', 'user-1', 'agent-1');

    expect(data.results[0].cells).toEqual([{ header: 'What did you like?', value: 'The advice column' }]);
  });

  // Rows stored before the answers were kept apart still load, with only their response text.
  it('returns no answers for a row that never had them stored', async () => {
    mockResults.mockResolvedValue([{
      id: 'result-1',
      rowNumber: 2,
      responseText: 'The advice column',
      cells: null,
      sortOrder: 0,
      values: [],
    }]);

    const data = await getPulseResults('job-1', 'user-1', 'agent-1');

    expect(data.results[0].cells).toBeNull();
  });

  it('reads rows in the order they appeared in the spreadsheet', async () => {
    await getPulseResults('job-1', 'user-1', 'agent-1');

    expect(mockResults).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: 'job-1' },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });

  it('returns nothing when the job does not belong to the user', async () => {
    mockJob.mockResolvedValue(null);

    await expect(getPulseResults('job-1', 'user-2', 'agent-1')).resolves.toEqual({ results: [], fields: [] });
    expect(mockResults).not.toHaveBeenCalled();
  });

  it('scopes the job lookup to the requesting user and agent', async () => {
    await getPulseResults('job-1', 'user-1', 'agent-1');

    expect(mockJob).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1', userId: 'user-1', aiAgentId: 'agent-1' },
    }));
  });

  it('throws a descriptive error when the read fails', async () => {
    mockResults.mockRejectedValue(new Error('db down'));

    await expect(getPulseResults('job-1', 'user-1', 'agent-1')).rejects.toThrow('Failed to load PULSE results');
  });
});
