import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import getPulseResultsRoute from '@/features/ai-agents/routes/pulse/get-pulse-results';
import {
  FAILED_RUN_OUTPUT_REASON,
  LEGACY_OUTPUT_REASON,
  PROCESSING_OUTPUT_REASON,
} from '@/features/ai-agents/utils/pulse/outputReasons';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getPulseResultsDal from '@/features/ai-agents/dal/pulse/getPulseResults';
import getPulseJob from '@/features/ai-agents/dal/pulse/getPulseJob';
import getPulseValueDistributions from '@/features/ai-agents/dal/pulse/getPulseValueDistributions';
import { AiAgentType } from '@/features/shared/types';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import {
  formatPulseError,
  stoppedUnexpectedlyError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { PulseNarrative } from '@/features/ai-agents/types/pulse/results';

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/pulse/getPulseResults');
jest.mock('@/features/ai-agents/dal/pulse/getPulseJob');
jest.mock('@/features/ai-agents/dal/pulse/getPulseValueDistributions');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetPulseResults = getPulseResultsDal as jest.Mock;
const mockGetPulseJob = getPulseJob as jest.Mock;
const mockGetDistributions = getPulseValueDistributions as jest.Mock;

const testRouter = router({
  getPulseResults: getPulseResultsRoute,
});

const agentId = '11111111-1111-1111-1111-111111111111';
const jobId = '22222222-2222-2222-2222-222222222222';
const input = { agentId, jobId };

const narrative: PulseNarrative = {
  headline: 'Attendees want more mentoring.',
  overview: 'Most responses were positive.',
  keyFindings: [],
  recommendedActions: [
    { action: 'Add more mentoring sessions', rationale: 'Mentoring was the most-praised topic.', finding: null },
  ],
  columnNotes: {},
  featuredColumns: [],
  quoteIds: [],
};

const warning = formatPulseError({
  cause: '2 of 50 responses couldn\'t be analyzed and were filled with their fallback values.',
  fix: 'Check the model is available, then run the survey again for a complete set.',
});

function jobRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: jobId,
    status: 'completed',
    errorMessage: null,
    surveyFilename: 'symposium.xlsx',
    responseCount: 50,
    createdAt: new Date('2026-09-25T14:00:00.000Z'),
    completedAt: new Date('2026-09-25T14:12:30.000Z'),
    modelId: 'model-1',
    modelName: 'Claude Opus 5',
    failedRowCount: 2,
    resultsProfile: { columns: [], breakdowns: [], quotes: [] },
    resultsNarrative: narrative,
    outputErrors: {},
    config: {
      fields: [
        { fieldName: 'Sentiment', fieldType: PulseFieldType.CATEGORY, allowedValues: ['Positive', 'Negative'] },
        { fieldName: 'Takeaway', fieldType: PulseFieldType.FREE_TEXT, allowedValues: [] },
        { fieldName: 'Topic', fieldType: PulseFieldType.CATEGORY, allowedValues: ['Mentoring', 'Other'] },
      ],
    },
    ...overrides,
  };
}

describe('getPulseResults route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
      errorAuditor: { createErrorRecord: jest.fn() },
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PULSE }]);
    mockGetPulseJob.mockResolvedValue(jobRecord());
    mockGetPulseResults.mockResolvedValue({
      fields: [{ fieldName: 'Sentiment', fieldType: PulseFieldType.CATEGORY, sortOrder: 0 }],
      results: [{
        id: 'result-1',
        rowNumber: 2,
        responseText: 'What did you think?:\nLove it!',
        cells: [{ header: 'What did you think?', value: 'Love it!' }],
        sortOrder: 0,
        values: [{ fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false }],
      }],
    });
    mockGetDistributions.mockResolvedValue([
      {
        fieldName: 'Sentiment',
        counts: [
          { value: 'Positive', count: 30, defaultedCount: 0 },
          { value: 'Negative', count: 20, defaultedCount: 3 },
        ],
      },
      { fieldName: 'Takeaway', counts: [{ value: 'More talks', count: 50, defaultedCount: 0 }] },
      {
        fieldName: 'Topic',
        counts: [
          { value: 'Mentoring', count: 40, defaultedCount: 1 },
          { value: 'Other', count: 10, defaultedCount: 1 },
        ],
      },
    ]);
  });

  it('returns the run view for a clean run alongside the rows for the spreadsheet', async () => {
    const result = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(result.run).toEqual({
      id: jobId,
      status: 'succeeded',
      surveyFilename: 'symposium.xlsx',
      modelName: 'Claude Opus 5',
      createdAt: '2026-09-25T14:00:00.000Z',
      completedAt: '2026-09-25T14:12:30.000Z',
      rowsInFile: 50,
      rowsAnalyzed: 48,
      failedRowCount: 2,
      message: null,
      fallbacksByColumn: [
        { fieldName: 'Sentiment', count: 3 },
        { fieldName: 'Topic', count: 2 },
      ],
      recommendedActions: [{ action: 'Add more mentoring sessions', rationale: 'Mentoring was the most-praised topic.' }],
      outputs: { dashboard: null, pdf: null, slides: null },
      hasLegacyOutputs: false,
    });
    expect(result.fields).toHaveLength(1);
    expect(result.results).toHaveLength(1);
  });

  it('counts fallbacks across every output column of the run', async () => {
    await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(mockGetDistributions).toHaveBeenCalledWith(jobId, ['Sentiment', 'Takeaway', 'Topic']);
  });

  it('reports a completed run with a stored message as succeeded with warnings', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({ errorMessage: warning }));

    const { run } = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(run.status).toBe('succeededWithWarnings');
    expect(run.message).toEqual({
      cause: '2 of 50 responses couldn\'t be analyzed and were filled with their fallback values.',
      fix: 'Check the model is available, then run the survey again for a complete set.',
    });
  });

  it('reports a failed run with its cause and fix and no outputs', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({
      status: 'error',
      errorMessage: formatPulseError(stoppedUnexpectedlyError()),
      completedAt: null,
      failedRowCount: null,
      resultsProfile: null,
      resultsNarrative: null,
      outputErrors: null,
    }));

    const { run } = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(run.status).toBe('failed');
    expect(run.message).toEqual({
      cause: stoppedUnexpectedlyError().cause,
      fix: stoppedUnexpectedlyError().fix,
    });
    expect(run.outputs).toEqual({
      dashboard: FAILED_RUN_OUTPUT_REASON,
      pdf: FAILED_RUN_OUTPUT_REASON,
      slides: FAILED_RUN_OUTPUT_REASON,
    });
    expect(run.hasLegacyOutputs).toBe(false);
  });

  it('shows an older failed run\'s plain message as the cause with no fix', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({
      status: 'error',
      errorMessage: 'Survey parsing failed',
      resultsProfile: null,
    }));

    const { run } = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(run.message).toEqual({ cause: 'Survey parsing failed', fix: null });
  });

  it('reports a run still in progress as processing with outputs pending', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({
      status: 'processing',
      completedAt: null,
      failedRowCount: null,
      resultsProfile: null,
      resultsNarrative: null,
      outputErrors: null,
    }));

    const { run } = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(run.status).toBe('processing');
    expect(run.message).toBeNull();
    expect(run.outputs.dashboard).toBe(PROCESSING_OUTPUT_REASON);
    expect(run.rowsInFile).toBeNull();
    expect(run.rowsAnalyzed).toBeNull();
  });

  // Review Focus: runs from before this change.
  it('marks a run from before this update as legacy without breaking the view', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({
      completedAt: null,
      modelId: null,
      modelName: null,
      failedRowCount: null,
      resultsProfile: null,
      resultsNarrative: null,
      outputErrors: null,
    }));

    const result = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(result.run).toMatchObject({
      status: 'succeeded',
      modelName: null,
      completedAt: null,
      rowsInFile: null,
      rowsAnalyzed: null,
      recommendedActions: null,
      hasLegacyOutputs: true,
      outputs: {
        dashboard: LEGACY_OUTPUT_REASON,
        pdf: LEGACY_OUTPUT_REASON,
        slides: LEGACY_OUTPUT_REASON,
      },
    });
    expect(result.results).toHaveLength(1);
  });

  it('shows the stored reason for an output that failed and keeps the others available', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({
      outputErrors: { pdf: 'The server\'s PDF renderer isn\'t available.' },
    }));

    const { run } = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(run.outputs).toEqual({
      dashboard: null,
      pdf: 'The server\'s PDF renderer isn\'t available.',
      slides: null,
    });
  });

  it('leaves recommended actions empty when the narrative was not generated', async () => {
    mockGetPulseJob.mockResolvedValue(jobRecord({ resultsNarrative: null }));

    const { run } = await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(run.recommendedActions).toBeNull();
  });

  it('rejects a job belonging to another user', async () => {
    mockGetPulseJob.mockResolvedValue(null);

    await expect(testRouter.createCaller(mockCtx).getPulseResults(input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'PULSE job not found',
    });
  });

  // One user's own run under a different PULSE agent stays out of this agent's results.
  it('looks the job and its rows up under the agent that was asked for', async () => {
    await testRouter.createCaller(mockCtx).getPulseResults(input);

    expect(mockGetPulseJob).toHaveBeenCalledWith(jobId, 'user-1', agentId);
    expect(mockGetPulseResults).toHaveBeenCalledWith(jobId, 'user-1', agentId);
  });

  it('rejects a job belonging to another agent of the same user', async () => {
    mockGetPulseJob.mockResolvedValue(null);

    await expect(testRouter.createCaller(mockCtx).getPulseResults(input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'PULSE job not found',
    });
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    await expect(testRouter.createCaller(mockCtx).getPulseResults(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects an agent of another type at the same id', async () => {
    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PRISM }]);

    await expect(testRouter.createCaller(mockCtx).getPulseResults(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });
});
