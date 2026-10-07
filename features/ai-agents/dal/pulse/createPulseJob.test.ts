import createPulseJob from './createPulseJob';
import db from '@/server/db';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { create: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCreate = db.agentPulseJob.create as jest.Mock;

const params = {
  id: 'job-1',
  aiAgentId: 'agent-1',
  userId: 'user-1',
  userGroupId: 'group-1',
  surveyFilename: 'symposium.xlsx',
  responseCount: 120,
  persona: 'You are a survey analyst.',
  resultsFocus: 'Compare regions.',
  modelId: 'claude-opus-5',
  modelName: 'Opus 5',
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
};

describe('createPulseJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'job-1' });
  });

  it('creates the job with its fields in one call', async () => {
    await createPulseJob(params);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        id: 'job-1',
        aiAgentId: 'agent-1',
        userId: 'user-1',
        userGroupId: 'group-1',
        surveyFilename: 'symposium.xlsx',
        responseCount: 120,
        status: 'queued',
        persona: 'You are a survey analyst.',
        resultsFocus: 'Compare regions.',
        modelId: 'claude-opus-5',
        modelName: 'Opus 5',
        sheetName: 'Feedback',
        headerRow: 1,
        inputColumns: ['B', 'C'],
        fields: {
          create: [
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
        },
      },
      select: { id: true },
    });
  });

  it('stores no response guidelines on a new run', async () => {
    await createPulseJob(params);

    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty('responseGuidelines');
  });

  it('returns the created job id', async () => {
    await expect(createPulseJob(params)).resolves.toEqual({ id: 'job-1' });
  });

  it('throws a descriptive error when the create fails', async () => {
    mockCreate.mockRejectedValue(new Error('db down'));

    await expect(createPulseJob(params)).rejects.toThrow('Failed to create PULSE job');
  });
});
