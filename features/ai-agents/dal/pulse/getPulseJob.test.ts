import getPulseJob from './getPulseJob';
import db from '@/server/db';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { findFirst: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFindFirst = db.agentPulseJob.findFirst as jest.Mock;

const profile = { columns: [], breakdowns: [], quotes: [] };

const record = {
  id: 'job-1',
  status: 'completed',
  errorMessage: null,
  surveyFilename: 'symposium.xlsx',
  responseCount: 120,
  modelId: 'claude-opus-5',
  modelName: 'Opus 5',
  failedRowCount: 2,
  completedAt: new Date('2026-09-14T00:12:00Z'),
  resultsProfile: profile,
  resultsNarrative: null,
  outputErrors: { pdf: 'The server\'s PDF renderer isn\'t available.' },
  createdAt: new Date('2026-09-14T00:00:00Z'),
  persona: 'You are a survey analyst.',
  resultsFocus: null,
  sheetName: 'Feedback',
  headerRow: 1,
  inputColumns: ['B', 'C'],
  fields: [
    {
      fieldName: 'Sentiment',
      prompt: 'Judge sentiment.',
      fieldType: 'category',
      allowedValues: ['Positive', 'Negative'],
      defaultValue: 'Positive',
      inputColumnRefs: [],
      sortOrder: 0,
    },
  ],
};

describe('getPulseJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(record);
  });

  it('scopes the lookup to the requesting user and agent', async () => {
    await getPulseJob('job-1', 'user-1', 'agent-1');

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', userId: 'user-1', aiAgentId: 'agent-1' } }),
    );
  });

  // The worker runs a job it was handed, so it reads without naming an agent.
  it('scopes the lookup to the user alone when no agent is named', async () => {
    await getPulseJob('job-1', 'user-1', null);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', userId: 'user-1' } }),
    );
  });

  it('returns the job with its field matrix as the job config', async () => {
    const job = await getPulseJob('job-1', 'user-1', 'agent-1');

    expect(job).toEqual({
      id: 'job-1',
      status: 'completed',
      errorMessage: null,
      surveyFilename: 'symposium.xlsx',
      responseCount: 120,
      modelId: 'claude-opus-5',
      modelName: 'Opus 5',
      failedRowCount: 2,
      completedAt: new Date('2026-09-14T00:12:00Z'),
      resultsProfile: profile,
      resultsNarrative: null,
      outputErrors: { pdf: 'The server\'s PDF renderer isn\'t available.' },
      createdAt: new Date('2026-09-14T00:00:00Z'),
      config: {
        persona: 'You are a survey analyst.',
        resultsFocus: null,
        sheetName: 'Feedback',
        headerRow: 1,
        inputColumns: ['B', 'C'],
        fields: [
          {
            fieldName: 'Sentiment',
            prompt: 'Judge sentiment.',
            fieldType: PulseFieldType.CATEGORY,
            allowedValues: ['Positive', 'Negative'],
            defaultValue: 'Positive',
            inputColumnRefs: [],
            sortOrder: 0,
          },
        ],
      },
    });
  });

  it('never loads the stored output bodies with the job', async () => {
    await getPulseJob('job-1', 'user-1', 'agent-1');

    const { select } = mockFindFirst.mock.calls[0][0];

    expect(select).not.toHaveProperty('dashboardHtml');
    expect(select).not.toHaveProperty('resultsDashboardHtml');
    expect(select).not.toHaveProperty('slidesHtml');
    expect(select).not.toHaveProperty('executiveSummaryPdf');
  });

  it('returns a run from before the outputs existed with its new fields empty', async () => {
    mockFindFirst.mockResolvedValue({
      ...record,
      modelId: null,
      modelName: null,
      failedRowCount: null,
      completedAt: null,
      resultsProfile: null,
      resultsNarrative: null,
      outputErrors: null,
      resultsFocus: null,
    });

    const job = await getPulseJob('job-1', 'user-1', 'agent-1');

    expect(job).toMatchObject({
      modelId: null,
      modelName: null,
      failedRowCount: null,
      completedAt: null,
      resultsProfile: null,
      resultsNarrative: null,
      outputErrors: null,
      config: expect.objectContaining({ resultsFocus: null }),
    });
  });

  it('returns a job config without response guidelines', async () => {
    const job = await getPulseJob('job-1', 'user-1', 'agent-1');

    expect(job).not.toHaveProperty('config.responseGuidelines');
    expect(mockFindFirst.mock.calls[0][0].select).not.toHaveProperty('responseGuidelines');
  });

  it('returns null when the job does not belong to the user', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getPulseJob('job-1', 'user-2', 'agent-1')).resolves.toBeNull();
  });

  it('throws a descriptive error when the read fails', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));

    await expect(getPulseJob('job-1', 'user-1', 'agent-1')).rejects.toThrow('Failed to load PULSE job');
  });
});
