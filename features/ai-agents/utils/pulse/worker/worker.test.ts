import { Worker } from 'bullmq';

import { startPulseWorker } from '@/features/ai-agents/utils/pulse/worker/worker';
import { getRedisClient } from '@/server/storage/redisConnection';
import { reportJobFailure } from '@/server/reportJobFailure';
import { storage } from '@/server/storage/redis';
import { AIFactory } from '@/features/ai-provider/factory';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import countFullyDefaultedRows from '@/features/ai-agents/dal/pulse/countFullyDefaultedRows';
import getPulseJob from '@/features/ai-agents/dal/pulse/getPulseJob';
import getProcessedRowNumbers from '@/features/ai-agents/dal/pulse/getProcessedRowNumbers';
import getPulseJobStatus from '@/features/ai-agents/dal/pulse/getPulseJobStatus';
import getPulseResults from '@/features/ai-agents/dal/pulse/getPulseResults';
import savePulseResult from '@/features/ai-agents/dal/pulse/savePulseResult';
import updatePulseJobOutputs from '@/features/ai-agents/dal/pulse/updatePulseJobOutputs';
import updatePulseJobStatus from '@/features/ai-agents/dal/pulse/updatePulseJobStatus';
import {
  formatPulseError,
  parsePulseErrorMessage,
  stoppedUnexpectedlyError,
  storageUnavailableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import generateResultsOutputs from '@/features/ai-agents/utils/pulse/results/generateResultsOutputs';
import extractRowValues from '@/features/ai-agents/utils/pulse/worker/extractRow';
import parseSurveySpreadsheet from '@/features/ai-agents/utils/pulse/worker/parseSurveySpreadsheet';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';

jest.mock('bullmq');
jest.mock('@/server/storage/redisConnection');
jest.mock('@/server/reportJobFailure');
jest.mock('@/server/storage/redis', () => ({
  storage: {
    del: jest.fn(),
    hset: jest.fn(),
  },
}));
jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/features/ai-provider/factory');
jest.mock('@/features/ai-agents/utils/aiFactoryCompletionAdapter');
jest.mock('@/features/document-upload-provider/factory');
jest.mock('@/features/ai-agents/dal/pulse/countFullyDefaultedRows');
jest.mock('@/features/ai-agents/dal/pulse/getPulseJob');
jest.mock('@/features/ai-agents/dal/pulse/getProcessedRowNumbers');
jest.mock('@/features/ai-agents/dal/pulse/getPulseJobStatus');
jest.mock('@/features/ai-agents/dal/pulse/getPulseResults');
jest.mock('@/features/ai-agents/dal/pulse/savePulseResult');
jest.mock('@/features/ai-agents/dal/pulse/updatePulseJobOutputs');
jest.mock('@/features/ai-agents/dal/pulse/updatePulseJobResponseCount');
jest.mock('@/features/ai-agents/dal/pulse/updatePulseJobStatus');
jest.mock('@/features/ai-agents/utils/pulse/worker/extractRow');
jest.mock('@/features/ai-agents/utils/pulse/worker/parseSurveySpreadsheet');
jest.mock('@/features/ai-agents/utils/pulse/results/generateResultsOutputs', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const jobId = 'job-1';

const fields = [
  {
    fieldName: 'Sentiment',
    prompt: 'Judge sentiment.',
    fieldType: PulseFieldType.CATEGORY,
    allowedValues: ['Positive', 'Neutral'],
    defaultValue: 'Neutral',
    inputColumnRefs: [],
    sortOrder: 0,
  },
  {
    fieldName: 'Takeaway',
    prompt: 'Summarize the response.',
    fieldType: PulseFieldType.FREE_TEXT,
    allowedValues: [],
    defaultValue: null,
    inputColumnRefs: [],
    sortOrder: 1,
  },
];

function surveyRow(rowNumber: number) {
  return {
    rowNumber,
    cells: { B: { column: 'B', header: 'What worked?', value: 'The mentoring' } },
    responseText: 'The mentoring',
  };
}

const surveyColumns = [
  { letter: 'A', header: 'Id', values: ['1', '2'] },
  { letter: 'B', header: 'What worked?', values: ['The mentoring', 'The mentoring'] },
];

const derivedValues = [
  { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null },
  { fieldName: 'Takeaway', value: 'Mentoring helped', wasDefaulted: false, failureReason: null },
];

function savedResult(rowNumber: number, sentiment: string) {
  return {
    id: `result-${rowNumber}`,
    rowNumber,
    responseText: 'The mentoring',
    sortOrder: rowNumber - 2,
    values: [
      { fieldName: 'Sentiment', value: sentiment, wasDefaulted: false },
      { fieldName: 'Takeaway', value: `Takeaway ${rowNumber}`, wasDefaulted: false },
    ],
  };
}

const outputs = {
  profile: { columns: [], breakdowns: [], quotes: [] },
  narrative: null,
  dashboardHtml: '<html>dashboard</html>',
  slidesHtml: '<html>slides</html>',
  executiveSummaryPdf: Buffer.from('%PDF-1.7'),
  errors: {},
};

function pulseJob(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      jobId,
      userId: 'user-1',
      agentId: 'agent-1',
      userGroupId: 'group-1',
      modelId: 'model-1',
      surveyFileKey: 'uploads/symposium.xlsx',
      surveyFilename: 'symposium.xlsx',
      documentUploadProviderId: 'provider-1',
    },
    attemptsMade: 0,
    opts: { attempts: 1 },
    ...overrides,
  };
}

const mockHset = storage.hset as jest.Mock;
const mockBuildSource = jest.fn();
const mockDeleteFile = jest.fn();
const mockGenerateOutputs = generateResultsOutputs as jest.Mock;
const mockUpdateOutputs = updatePulseJobOutputs as jest.Mock;

function progressCallIndex(progress: string): number {
  return mockHset.mock.calls.findIndex(([, value]) => value.progress === progress);
}

describe('startPulseWorker', () => {
  let jobProcessor: (job: unknown) => Promise<unknown>;
  let failedHandler: (job: unknown, error: Error) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    (getRedisClient as jest.Mock).mockReturnValue({});

    jest.mocked(Worker).mockImplementation((_name, processor) => {
      jobProcessor = processor as (job: unknown) => Promise<unknown>;

      return {
        isRunning: jest.fn().mockReturnValue(false),
        run: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        on: jest.fn((event: string, handler: (job: unknown, error: Error) => Promise<void>) => {
          if (event === 'failed') {
            failedHandler = handler;
          }
        }),
      } as unknown as Worker;
    });

    mockDeleteFile.mockResolvedValue(undefined);
    mockBuildSource.mockResolvedValue({
      source: {
        fetchFile: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
        deleteFile: mockDeleteFile,
      },
    });

    jest.mocked(DocumentUploadFactory).mockImplementation(() => ({
      buildSource: mockBuildSource,
    }) as unknown as DocumentUploadFactory);

    jest.mocked(AIFactory).mockImplementation(() => ({
      buildUserSource: jest.fn().mockResolvedValue({ model: { name: 'Claude Opus 5' } }),
    }) as unknown as AIFactory);

    (getPulseJob as jest.Mock).mockResolvedValue({
      surveyFilename: 'symposium.xlsx',
      responseCount: 2,
      modelId: 'model-1',
      modelName: 'Claude Opus 5',
      config: {
        persona: 'You are an analyst.',
        resultsFocus: 'Mentoring',
        sheetName: 'Feedback',
        headerRow: 1,
        inputColumns: ['B'],
        fields,
      },
    });
    (getProcessedRowNumbers as jest.Mock).mockResolvedValue([]);
    (countFullyDefaultedRows as jest.Mock).mockResolvedValue(0);
    (parseSurveySpreadsheet as jest.Mock).mockResolvedValue({
      workbook: {},
      rows: [surveyRow(2), surveyRow(3)],
      surveyColumns,
    });
    (extractRowValues as jest.Mock).mockResolvedValue(derivedValues);
    (getPulseResults as jest.Mock).mockResolvedValue({
      fields: [],
      results: [savedResult(2, 'Positive'), savedResult(3, 'Neutral')],
    });
    (savePulseResult as jest.Mock).mockResolvedValue(undefined);
    mockGenerateOutputs.mockResolvedValue(outputs);
    mockUpdateOutputs.mockResolvedValue(undefined);
    mockHset.mockResolvedValue(1);
  });

  it('creates a worker for the pulse queue', async () => {
    await startPulseWorker();

    expect(Worker).toHaveBeenCalledWith(
      'pulse-jobs',
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
  });

  it('skips startup when Redis is not available', async () => {
    (getRedisClient as jest.Mock).mockImplementation(() => {
      throw new Error('Redis not available');
    });

    await startPulseWorker();

    expect(Worker).not.toHaveBeenCalled();
  });

  it('marks a run complete once every response is stored', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(savePulseResult).toHaveBeenCalledTimes(2);
    expect(updatePulseJobStatus).toHaveBeenCalledWith(jobId, 'completed', null);
  });

  it('stores each answer under the question it answers, not only the joined-up text', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(savePulseResult).toHaveBeenCalledWith(expect.objectContaining({
      rowNumber: 2,
      cells: [{ header: 'What worked?', value: 'The mentoring' }],
    }));
  });

  it('names the chosen model to the row analysis so its errors can say which model failed', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect((extractRowValues as jest.Mock).mock.calls[0][0].modelName).toBe('Claude Opus 5');
  });

  it('resumes without re-analyzing responses that are already stored', async () => {
    (getProcessedRowNumbers as jest.Mock).mockResolvedValue([2]);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(extractRowValues).toHaveBeenCalledTimes(1);
    expect((extractRowValues as jest.Mock).mock.calls[0][0].row.rowNumber).toBe(3);
  });

  it('says how many responses it is reading before the file is downloaded', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ progress: 'Reading 2 responses from the survey file...' }),
    );
  });

  it('counts the responses off one by one as it analyzes them', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ progress: 'Analyzing 1 of 2 responses' }),
    );
    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ progress: 'Analyzing 2 of 2 responses' }),
    );
  });

  it('numbers a resumed run from the responses already saved', async () => {
    (getProcessedRowNumbers as jest.Mock).mockResolvedValue([2]);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ progress: 'Analyzing 2 of 2 responses' }),
    );
  });

  it('profiles the columns, builds the outputs, saves them, then finishes the run', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    const profilingOrder = mockHset.mock.invocationCallOrder[progressCallIndex('Profiling columns…')];
    const completedIndex = (updatePulseJobStatus as jest.Mock).mock.calls
      .findIndex(([, status]) => status === 'completed');
    const completedOrder = (updatePulseJobStatus as jest.Mock).mock.invocationCallOrder[completedIndex];

    expect(profilingOrder).toBeLessThan(mockGenerateOutputs.mock.invocationCallOrder[0]);
    expect(mockGenerateOutputs.mock.invocationCallOrder[0])
      .toBeLessThan(mockUpdateOutputs.mock.invocationCallOrder[0]);
    expect(mockUpdateOutputs.mock.invocationCallOrder[0]).toBeLessThan(completedOrder);
    expect(completedOrder).toBeLessThan(mockDeleteFile.mock.invocationCallOrder[0]);
  });

  it('shows the narrative and output steps as progress', async () => {
    await startPulseWorker();
    await jobProcessor(pulseJob());

    await mockGenerateOutputs.mock.calls[0][0].onProgress('Writing the results narrative…');

    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ status: 'processing', progress: 'Writing the results narrative…' }),
    );
  });

  it('builds the outputs from every survey column and the run facts', async () => {
    (countFullyDefaultedRows as jest.Mock).mockResolvedValue(1);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(mockGenerateOutputs).toHaveBeenCalledWith(expect.objectContaining({
      jobId,
      surveyColumns,
      rows: [surveyRow(2), surveyRow(3)],
      persona: 'You are an analyst.',
      resultsFocus: 'Mentoring',
      facts: {
        surveyFilename: 'symposium.xlsx',
        modelName: 'Claude Opus 5',
        completedAt: expect.any(Date),
        rowsInFile: 2,
        rowsAnalyzed: 1,
        failedRowCount: 1,
      },
    }));
  });

  // Review Focus: a resumed run profiles the whole file, not just the final attempt's rows.
  it('profiles a resumed run from every saved value, not just the rows this attempt analyzed', async () => {
    (getProcessedRowNumbers as jest.Mock).mockResolvedValue([2]);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    const { toolColumns, rows, facts } = mockGenerateOutputs.mock.calls[0][0];

    expect(getPulseResults).toHaveBeenCalledWith(jobId, 'user-1', null);
    expect(rows).toHaveLength(2);
    expect(toolColumns[0]).toMatchObject({ fieldName: 'Sentiment', values: ['Positive', 'Neutral'] });
    expect(toolColumns[1]).toMatchObject({ fieldName: 'Takeaway', values: ['Takeaway 2', 'Takeaway 3'] });
    expect(facts).toMatchObject({ rowsInFile: 2 });
  });

  it('saves the outputs, counts, and finish time together', async () => {
    (countFullyDefaultedRows as jest.Mock).mockResolvedValue(1);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(mockUpdateOutputs).toHaveBeenCalledWith(jobId, {
      outputs,
      failedRowCount: 1,
      completedAt: expect.any(Date),
    });
    expect(mockUpdateOutputs.mock.calls[0][1].completedAt)
      .toBe(mockGenerateOutputs.mock.calls[0][0].facts.completedAt);
  });

  // Review Focus: Chromium missing or crashing.
  it('completes the run and keeps the other outputs when the PDF could not be made', async () => {
    const withoutPdf = {
      ...outputs,
      executiveSummaryPdf: null,
      errors: { pdf: 'The server\'s PDF renderer isn\'t available.' },
    };
    mockGenerateOutputs.mockResolvedValue(withoutPdf);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(mockUpdateOutputs).toHaveBeenCalledWith(jobId, expect.objectContaining({ outputs: withoutPdf }));
    expect(updatePulseJobStatus).toHaveBeenCalledWith(
      jobId,
      'completed',
      expect.stringContaining('some results files couldn\'t be made'),
    );
    expect(mockDeleteFile).toHaveBeenCalledWith('uploads/symposium.xlsx');
  });

  it('warns on the row when every results file failed, rather than reporting a clean run', async () => {
    mockGenerateOutputs.mockResolvedValue({
      profile: { columns: [], breakdowns: [], quotes: [] },
      narrative: null,
      dashboardHtml: null,
      slidesHtml: null,
      executiveSummaryPdf: null,
      errors: {
        narrative: 'not profiled',
        dashboard: 'not profiled',
        pdf: 'not profiled',
        slides: 'not profiled',
      },
    });

    await startPulseWorker();
    await jobProcessor(pulseJob());

    const warning = (updatePulseJobStatus as jest.Mock).mock.calls
      .find(([, status]) => status === 'completed')?.[2];
    const parsed = parsePulseErrorMessage(warning);

    expect(parsed.cause).toContain('some results files couldn\'t be made');
    expect(parsed.fix).toContain('Results tab');
    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ status: 'completed', error: warning }),
    );
  });

  // Every file downloads, so the warning must not send the user looking for a missing one.
  it('names the missing written summary when only the summary failed', async () => {
    mockGenerateOutputs.mockResolvedValue({ ...outputs, narrative: null, errors: { narrative: 'the model timed out' } });

    await startPulseWorker();
    await jobProcessor(pulseJob());

    const warning = (updatePulseJobStatus as jest.Mock).mock.calls
      .find(([, status]) => status === 'completed')?.[2];

    expect(warning).toContain('written summary couldn\'t be written');
    expect(warning).not.toContain('results files couldn\'t be made');
    expect(parsePulseErrorMessage(warning).fix).not.toContain('Results tab');
  });

  // When the files are gone too, the warning must not send the user to them for the numbers.
  it('does not promise results files when the summary and the files both failed', async () => {
    mockGenerateOutputs.mockResolvedValue({
      ...outputs,
      narrative: null,
      errors: { narrative: 'the model timed out', pdf: 'no renderer' },
    });

    await startPulseWorker();
    await jobProcessor(pulseJob());

    const warning = (updatePulseJobStatus as jest.Mock).mock.calls
      .find(([, status]) => status === 'completed')?.[2];

    expect(warning).toContain('some results files couldn\'t be made');
    expect(warning).toContain('written summary couldn\'t be written');
    expect(warning).not.toContain('results files show their numbers');
  });

  it('reports lost responses and failed results files in one warning', async () => {
    (countFullyDefaultedRows as jest.Mock).mockResolvedValue(1);
    mockGenerateOutputs.mockResolvedValue({ ...outputs, errors: { pdf: 'no renderer' } });

    await startPulseWorker();
    await jobProcessor(pulseJob());

    const warning = (updatePulseJobStatus as jest.Mock).mock.calls
      .find(([, status]) => status === 'completed')?.[2];

    expect(warning).toContain('1 of 2 responses couldn\'t be analyzed');
    expect(warning).toContain('some results files couldn\'t be made');
    expect(parsePulseErrorMessage(warning).fix).toContain('Results tab');
  });

  it('tells the user what to fix when the survey file cannot be reached', async () => {
    mockBuildSource.mockRejectedValue(new Error('provider row missing'));

    await startPulseWorker();
    await expect(jobProcessor(pulseJob())).rejects.toThrow();

    expect(updatePulseJobStatus).toHaveBeenCalledWith(
      jobId,
      'error',
      formatPulseError(storageUnavailableError()),
    );
    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ status: 'error', error: formatPulseError(storageUnavailableError()) }),
    );
  });

  // An internal exception never becomes the user's stated cause, however it reads.
  it('stores an unexpected failure as the generic stop, not the internal message', async () => {
    (getPulseJob as jest.Mock).mockResolvedValue(null);

    await startPulseWorker();
    await expect(jobProcessor(pulseJob())).rejects.toThrow();

    expect(updatePulseJobStatus).toHaveBeenCalledWith(
      jobId,
      'error',
      formatPulseError(stoppedUnexpectedlyError()),
    );
    const stored = (updatePulseJobStatus as jest.Mock).mock.calls
      .find(([, status]) => status === 'error')?.[2];
    expect(stored).not.toContain('PULSE job configuration');
  });

  it('keeps a cause and fix raised by an earlier step as written', async () => {
    const stored = formatPulseError({
      cause: 'The worksheet \'Feedback\' isn\'t in the uploaded survey.',
      fix: 'Pick a worksheet from the list, or re-upload the file it came from.',
    });
    (parseSurveySpreadsheet as jest.Mock).mockRejectedValue(new Error(stored));

    await startPulseWorker();
    await expect(jobProcessor(pulseJob())).rejects.toThrow();

    expect(updatePulseJobStatus).toHaveBeenCalledWith(jobId, 'error', stored);
  });

  it('records a response it could not analyze instead of dropping it', async () => {
    (extractRowValues as jest.Mock)
      .mockRejectedValueOnce(new Error('provider outage'))
      .mockResolvedValue(derivedValues);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(savePulseResult).toHaveBeenCalledWith(expect.objectContaining({
      rowNumber: 2,
      values: [
        expect.objectContaining({ fieldName: 'Sentiment', value: 'Neutral', wasDefaulted: true }),
        expect.objectContaining({ fieldName: 'Takeaway', value: '', wasDefaulted: true }),
      ],
    }));
  });

  it('says how many responses were lost, with a fix, rather than reporting a clean run', async () => {
    (countFullyDefaultedRows as jest.Mock).mockResolvedValue(1);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    const warning = (updatePulseJobStatus as jest.Mock).mock.calls
      .find(([, status]) => status === 'completed')?.[2];
    const parsed = parsePulseErrorMessage(warning);

    expect(parsed.cause).toContain('1 of 2 responses couldn\'t be analyzed');
    expect(parsed.fix).not.toBeNull();
    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ status: 'completed', error: warning }),
    );
  });

  it('still reports a response lost on an earlier attempt after a retry finished the run', async () => {
    (getProcessedRowNumbers as jest.Mock).mockResolvedValue([2]);
    (countFullyDefaultedRows as jest.Mock).mockResolvedValue(1);

    await startPulseWorker();
    await jobProcessor(pulseJob());

    expect(extractRowValues).toHaveBeenCalledTimes(1);
    expect(updatePulseJobStatus).toHaveBeenCalledWith(
      jobId,
      'completed',
      expect.stringContaining('1 of 2 responses couldn\'t be analyzed'),
    );
  });

  it('leaves a job that stopped before finishing in a state the user can see', async () => {
    (getPulseJobStatus as jest.Mock).mockResolvedValue({ status: 'processing', errorMessage: null });

    await startPulseWorker();
    await failedHandler(
      pulseJob({ finishedOn: Date.now() }),
      new Error('job stalled more than allowable limit'),
    );

    expect(updatePulseJobStatus).toHaveBeenCalledWith(
      jobId,
      'error',
      formatPulseError(stoppedUnexpectedlyError()),
    );
    expect(mockHset).toHaveBeenCalledWith(
      `pulse-job:${jobId}`,
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('leaves an attempt that will be retried alone', async () => {
    await startPulseWorker();
    await failedHandler(pulseJob(), new Error('Bedrock timeout'));

    expect(updatePulseJobStatus).not.toHaveBeenCalled();
  });

  // A PULSE failure shows up in the same error log an admin reads for every other agent.
  it('records every failed attempt in the error log, including ones that will be retried', async () => {
    const job = pulseJob();
    const error = new Error('Bedrock timeout');

    await startPulseWorker();
    await failedHandler(job, error);

    expect(reportJobFailure).toHaveBeenCalledWith(job, error);
  });

  it('does not overwrite the reason a finished job already recorded', async () => {
    (getPulseJobStatus as jest.Mock).mockResolvedValue({
      status: 'error',
      errorMessage: 'The survey file could not be read',
    });

    await startPulseWorker();
    await failedHandler(pulseJob({ finishedOn: Date.now() }), new Error('Bedrock timeout'));

    expect(updatePulseJobStatus).not.toHaveBeenCalled();
  });
});
