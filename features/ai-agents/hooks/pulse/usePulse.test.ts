import { act, renderHook, waitFor } from '@testing-library/react';

import { usePulse } from '@/features/ai-agents/hooks/pulse/usePulse';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type { PulseJobConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import {
  formatPulseError,
  stoppedUnexpectedlyError,
  storageUnavailableError,
  uploadNetworkError,
  uploadTimedOutError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

const mockGetUploadUrl = jest.fn();
const mockStartAnalysis = jest.fn();
const mockStatus = jest.fn();
const mockActiveJob = jest.fn();
const mockResults = jest.fn();

jest.mock('@/features/ai-agents/api/pulse/get-pulse-upload-url', () => ({
  __esModule: true,
  default: () => ({ mutateAsync: mockGetUploadUrl, isPending: false }),
}));

jest.mock('@/features/ai-agents/api/pulse/start-pulse-analysis', () => ({
  __esModule: true,
  default: () => ({ mutateAsync: mockStartAnalysis, isPending: false }),
}));

jest.mock('@/features/ai-agents/api/pulse/get-pulse-status', () => ({
  __esModule: true,
  default: () => ({ data: mockStatus() }),
}));

jest.mock('@/features/ai-agents/api/pulse/get-active-pulse-job', () => ({
  __esModule: true,
  default: () => ({ data: mockActiveJob() }),
}));

jest.mock('@/features/ai-agents/api/pulse/get-pulse-results', () => ({
  __esModule: true,
  default: () => ({ data: mockResults() }),
}));

const config: PulseJobConfig = {
  persona: 'You analyze symposium feedback.',
  resultsFocus: null,
  sheetName: 'Feedback',
  headerRow: 1,
  inputColumns: ['B'],
  fields: [{
    fieldName: 'Sentiment',
    fieldType: PulseFieldType.CATEGORY,
    prompt: 'Classify the sentiment.',
    allowedValues: ['Positive', 'Neutral', 'Negative'],
    defaultValue: 'Neutral',
    inputColumnRefs: [],
    sortOrder: 0,
  }],
};

type UploadOutcome = { event: 'load' | 'error' | 'timeout'; status: number };

function mockUpload({ event, status }: UploadOutcome) {
  global.XMLHttpRequest = jest.fn().mockImplementation(() => ({
    timeout: 0,
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn(),
    status,
    statusText: status === 200 ? 'OK' : 'Forbidden',
    addEventListener: (name: string, handler: () => void) => {
      if (name === event) {
        setTimeout(handler, 0);
      }
    },
  })) as unknown as typeof XMLHttpRequest;
}

function surveyFile() {
  return new File(['x'], 'symposium.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function startParams() {
  return {
    surveyFile: surveyFile(),
    modelId: 'model-1',
    responseCount: 120,
    config,
  };
}

async function start(hook: { current: ReturnType<typeof usePulse> }) {
  await act(async () => {
    await hook.current.startAnalysis(startParams());
  });
}

// Resolves to what the start rejected with, or null when it succeeded.
async function startAndCatch(hook: { current: ReturnType<typeof usePulse> }): Promise<Error | null> {
  let thrown: Error | null = null;

  await act(async () => {
    try {
      await hook.current.startAnalysis(startParams());
    } catch (error) {
      thrown = error as Error;
    }
  });

  return thrown;
}

describe('usePulse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus.mockReturnValue(undefined);
    mockActiveJob.mockReturnValue(undefined);
    mockResults.mockReturnValue(undefined);
    mockGetUploadUrl.mockResolvedValue({
      surveyPresignedUrl: 'https://s3/put',
      surveyFileKey: 'key-1',
      documentUploadProviderId: 'provider-1',
    });
    mockStartAnalysis.mockResolvedValue({ jobId: 'job-1', message: 'queued' });
    mockUpload({ event: 'load', status: 200 });
  });

  it('starts idle and not processing', () => {
    const { result } = renderHook(() => usePulse('agent-1'));

    expect(result.current.jobStatus).toBe('idle');
    expect(result.current.isProcessing).toBe(false);
  });

  it('requests an upload url for the chosen survey file', async () => {
    const { result } = renderHook(() => usePulse('agent-1'));

    await start(result);

    expect(mockGetUploadUrl).toHaveBeenCalledWith({
      agentId: 'agent-1',
      surveyFileName: 'symposium.xlsx',
    });
  });

  it('queues the job with the uploaded file key, the response count, and the whole config', async () => {
    const { result } = renderHook(() => usePulse('agent-1'));

    await start(result);

    expect(mockStartAnalysis).toHaveBeenCalledWith({
      agentId: 'agent-1',
      surveyFileKey: 'key-1',
      surveyFileName: 'symposium.xlsx',
      documentUploadProviderId: 'provider-1',
      modelId: 'model-1',
      responseCount: 120,
      ...config,
      userGroupId: undefined,
    });
  });

  it('is processing while it polls a queued job', async () => {
    const { result } = renderHook(() => usePulse('agent-1'));

    await start(result);

    expect(result.current.isProcessing).toBe(true);
  });

  it('reports the progress message from the worker', async () => {
    const { result, rerender } = renderHook(() => usePulse('agent-1'));

    await start(result);
    mockStatus.mockReturnValue({ status: 'processing', progress: 'Profiling columns…', error: null });
    rerender();

    await waitFor(() => expect(result.current.progress).toBe('Profiling columns…'));
  });

  it('calls onComplete and exposes the completed job id when the worker finishes', async () => {
    const onComplete = jest.fn();
    const { result, rerender } = renderHook(() => usePulse('agent-1', { onComplete }));

    await start(result);
    mockStatus.mockReturnValue({ status: 'completed', progress: 'Done', error: null });
    rerender();

    await waitFor(() => expect(result.current.completedJobId).toBe('job-1'));
    expect(result.current.jobStatus).toBe('completed');
    expect(onComplete).toHaveBeenCalled();
  });

  it('surfaces the worker\'s cause and fix and stops processing on failure', async () => {
    const onError = jest.fn();
    const stored = formatPulseError(storageUnavailableError());
    const { result, rerender } = renderHook(() => usePulse('agent-1', { onError }));

    await start(result);
    mockStatus.mockReturnValue({ status: 'error', progress: null, error: stored });
    rerender();

    await waitFor(() => expect(result.current.jobStatus).toBe('error'));
    expect(result.current.error).toBe(stored);
    expect(result.current.isProcessing).toBe(false);
    expect(onError).toHaveBeenCalledWith(stored);
  });

  it('explains a failure the worker gave no reason for', async () => {
    const { result, rerender } = renderHook(() => usePulse('agent-1'));

    await start(result);
    mockStatus.mockReturnValue({ status: 'error', progress: null, error: null });
    rerender();

    await waitFor(() => expect(result.current.jobStatus).toBe('error'));
    expect(result.current.error).toBe(formatPulseError(stoppedUnexpectedlyError()));
  });

  it('explains an upload the storage rejected with a cause and fix', async () => {
    mockUpload({ event: 'load', status: 403 });
    const { result } = renderHook(() => usePulse('agent-1'));

    const thrown = await startAndCatch(result);

    expect(thrown?.message).toBe(formatPulseError(storageUnavailableError()));
    expect(mockStartAnalysis).not.toHaveBeenCalled();
  });

  it('explains an upload that lost its connection', async () => {
    mockUpload({ event: 'error', status: 0 });
    const { result } = renderHook(() => usePulse('agent-1'));

    const thrown = await startAndCatch(result);

    expect(thrown?.message).toBe(formatPulseError(uploadNetworkError()));
  });

  it('explains an upload that took too long', async () => {
    mockUpload({ event: 'timeout', status: 0 });
    const { result } = renderHook(() => usePulse('agent-1'));

    const thrown = await startAndCatch(result);

    expect(thrown?.message).toBe(formatPulseError(uploadTimedOutError()));
  });

  it('returns to idle after a failed start so the run can be tried again', async () => {
    mockUpload({ event: 'error', status: 0 });
    const { result } = renderHook(() => usePulse('agent-1'));

    await startAndCatch(result);

    expect(result.current.jobStatus).toBe('idle');
    expect(result.current.progress).toBe('');
    expect(result.current.isProcessing).toBe(false);
  });

  it('passes a queueing failure on to the page and returns to idle', async () => {
    mockStartAnalysis.mockRejectedValue(new Error('The analysis queue isn\'t running.'));
    const { result } = renderHook(() => usePulse('agent-1'));

    const thrown = await startAndCatch(result);

    expect(thrown?.message).toBe('The analysis queue isn\'t running.');
    expect(result.current.jobStatus).toBe('idle');
  });

  it('resumes an in-progress run found on the server when the page loads', async () => {
    mockActiveJob.mockReturnValue({ job: { id: 'job-old', status: 'processing', responseCount: 120 } });

    const { result } = renderHook(() => usePulse('agent-1'));

    await waitFor(() => expect(result.current.jobStatus).toBe('processing'));
    expect(result.current.isProcessing).toBe(true);
  });

  it('does not resume the old run again after an explicit reset', async () => {
    mockActiveJob.mockReturnValue({ job: { id: 'job-old', status: 'processing', responseCount: 120 } });

    const { result, rerender } = renderHook(() => usePulse('agent-1'));

    await waitFor(() => expect(result.current.jobStatus).toBe('processing'));

    act(() => result.current.reset());
    rerender();

    expect(result.current.jobStatus).toBe('idle');
  });

  it('exposes the run view and rows of the completed run', async () => {
    mockResults.mockReturnValue({
      run: { id: 'job-1', status: 'succeeded' },
      fields: [],
      results: [],
    });

    const { result } = renderHook(() => usePulse('agent-1'));

    expect(result.current.resultsData?.run.status).toBe('succeeded');
  });
});
