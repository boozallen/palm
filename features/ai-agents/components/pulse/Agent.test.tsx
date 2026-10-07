import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import Agent from '@/features/ai-agents/components/pulse/Agent';
import type { PulseConfigureValues } from '@/features/ai-agents/components/pulse/ConfigureForm';
import { PULSE_DEFAULT_PERSONA } from '@/features/ai-agents/data/pulse/prompts';
import buildMatrixWorkbook from '@/features/ai-agents/utils/pulse/buildMatrixWorkbook';
import detectSurveyLayout from '@/features/ai-agents/utils/pulse/detectSurveyLayout';
import downloadBlob from '@/features/ai-agents/utils/pulse/downloadBlob';
import parsePromptMatrix, { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';
import type { SurveyLayout } from '@/features/ai-agents/utils/pulse/detectSurveyLayout';
import type { PulseRunView } from '@/features/ai-agents/types/pulse/results';
import {
  PulseFieldType,
  type PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

type MockPulseOptions = {
  onComplete?: () => void;
  onError?: (message: string) => void;
};

const mockUsePulse = jest.fn();
const mockPulseOptions: { current: MockPulseOptions } = { current: {} };
const mockJobs = jest.fn();
const mockResults = jest.fn();
const mockModels = jest.fn();
const mockGate = jest.fn();
const mockStartAnalysis = jest.fn();
const mockParsePreview = jest.fn();

jest.mock('@/features/ai-agents/hooks/pulse/usePulse', () => ({
  usePulse: (...args: [string, MockPulseOptions]) => {
    mockPulseOptions.current = args[1];
    return mockUsePulse();
  },
}));

jest.mock('@/features/ai-agents/api/pulse/get-pulse-jobs', () => ({
  __esModule: true,
  default: () => mockJobs(),
}));

jest.mock('@/features/ai-agents/api/pulse/get-pulse-results', () => ({
  __esModule: true,
  default: () => mockResults(),
}));

jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: () => mockModels(),
}));

jest.mock('@/features/ai-agents/utils/pulse/parseSurveyPreview', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockParsePreview(...args),
}));

// Keeps the real matrix constants so a change to one can't pass against a stale copy.
jest.mock('@/features/ai-agents/utils/pulse/parsePromptMatrix', () => ({
  ...jest.requireActual('@/features/ai-agents/utils/pulse/parsePromptMatrix'),
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/ai-agents/utils/pulse/detectSurveyLayout', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/ai-agents/utils/pulse/buildMatrixWorkbook', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/ai-agents/utils/pulse/downloadBlob', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/ai-agents/utils/pulse/showPulseError', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: () => ({ gate: mockGate }),
}));

jest.mock('@/features/ai-agents/components/pulse/SurveyUpload', () => ({
  __esModule: true,
  default: ({
    layout,
    preview,
    error,
    onFileChange,
    onSheetChange,
  }: {
    layout: SurveyLayout | null;
    preview: { responseCount: number } | null;
    error: string | null;
    onFileChange: (file: File | null) => void;
    onSheetChange: (sheetName: string) => void;
  }) => (
    <div>
      <input
        type='file'
        data-testid='pulse-survey-file-input'
        onChange={(event) => {
          const [file] = Array.from(event.currentTarget.files ?? []);
          onFileChange(file ?? null);
        }}
      />
      <button type='button' data-testid='pulse-pick-sheet' onClick={() => onSheetChange('Round two')}>
        pick sheet
      </button>
      {layout && (
        <span data-testid='pulse-detected-layout'>{`${layout.sheetName}:${layout.headerRow}`}</span>
      )}
      {preview && <span data-testid='pulse-preview-count'>{preview.responseCount}</span>}
      {error && <span data-testid='pulse-preview-error'>{error}</span>}
    </div>
  ),
}));

jest.mock('@/features/ai-agents/components/pulse/ConfigureForm', () => ({
  __esModule: true,
  default: ({
    values,
    errors,
    disabled,
    onChange,
  }: {
    values: PulseConfigureValues;
    errors: Record<string, string>;
    disabled: boolean;
    onChange: (next: PulseConfigureValues) => void;
  }) => (
    <div data-testid='pulse-configure-form' data-disabled={String(disabled)}>
      <button
        type='button'
        data-testid='pulse-type-persona'
        onClick={() => onChange({ ...values, persona: 'typed persona' })}
      >
        type persona
      </button>
      <button
        type='button'
        data-testid='pulse-clear-persona'
        onClick={() => onChange({ ...values, persona: '' })}
      >
        clear persona
      </button>
      <button
        type='button'
        data-testid='pulse-type-focus'
        onClick={() => onChange({ ...values, resultsFocus: 'Focus on regional differences.' })}
      >
        type focus
      </button>
      <button
        type='button'
        data-testid='pulse-type-long-focus'
        onClick={() => onChange({ ...values, resultsFocus: 'x'.repeat(1001) })}
      >
        type long focus
      </button>
      <span data-testid='pulse-persona-value'>{values.persona}</span>
      <span data-testid='pulse-focus-value'>{values.resultsFocus ?? ''}</span>
      {errors.persona && <span data-testid='pulse-persona-error'>{errors.persona}</span>}
      {errors.resultsFocus && <span data-testid='pulse-focus-error'>{errors.resultsFocus}</span>}
    </div>
  ),
}));

jest.mock('@/features/ai-agents/components/pulse/TestRowPanel', () => ({
  __esModule: true,
  default: ({ disabledReason }: { disabledReason: string | null }) => (
    <div data-testid='pulse-test-panel'>
      <button type='button' data-testid='pulse-test-run' disabled={Boolean(disabledReason)}>
        test
      </button>
    </div>
  ),
}));

jest.mock('@/features/ai-agents/components/pulse/ProcessDashboard', () => ({
  __esModule: true,
  default: ({ run }: { run: PulseRunView }) => (
    <div data-testid='pulse-process-dashboard'>{run.status}</div>
  ),
}));

const mockParse = parsePromptMatrix as jest.Mock;
const mockDetectLayout = detectSurveyLayout as jest.Mock;
const mockBuildMatrix = buildMatrixWorkbook as jest.Mock;
const mockDownloadBlob = downloadBlob as jest.Mock;
const mockShowPulseError = showPulseError as jest.Mock;

const LAYOUT: SurveyLayout = {
  sheetName: 'Feedback',
  headerRow: 1,
  columns: ['B'],
  headers: [{ letter: 'B', header: 'What did you think?' }],
  sheetNames: ['Feedback'],
};

const WIDE_LAYOUT: SurveyLayout = {
  ...LAYOUT,
  columns: ['A', 'B', 'C'],
  headers: [
    { letter: 'A', header: 'ID' },
    { letter: 'B', header: 'What did you think?' },
    { letter: 'C', header: 'Revenue' },
  ],
};

const FIELD: PulseFieldConfig = {
  fieldName: 'Sentiment',
  prompt: 'Choose how they feel.',
  fieldType: PulseFieldType.CATEGORY,
  allowedValues: ['Positive', 'Negative'],
  defaultValue: MATRIX_FALLBACK_VALUE,
  inputColumnRefs: ['B'],
  sortOrder: 0,
};

const idleHook = {
  startAnalysis: mockStartAnalysis,
  reset: jest.fn(),
  isProcessing: false,
  jobStatus: 'idle',
  progress: '',
  resultsData: null,
  completedJobId: null,
  error: null,
};

const completedJob = {
  id: 'job-1',
  status: 'completed',
  surveyFilename: 'symposium.xlsx',
  responseCount: 120,
  createdAt: new Date('2026-09-14T12:00:00Z').toISOString(),
};

const failedJob = {
  id: 'job-2',
  status: 'error',
  surveyFilename: 'broken.xlsx',
  responseCount: 40,
  createdAt: new Date('2026-09-15T12:00:00Z').toISOString(),
};

const processingJob = {
  id: 'job-3',
  status: 'processing',
  surveyFilename: 'running.xlsx',
  responseCount: 60,
  createdAt: new Date('2026-09-16T12:00:00Z').toISOString(),
};

const RUN_VIEW: PulseRunView = {
  id: 'job-1',
  status: 'succeeded',
  surveyFilename: 'symposium.xlsx',
  modelName: 'Opus 5',
  createdAt: '2026-09-14T12:00:00.000Z',
  completedAt: '2026-09-14T12:05:00.000Z',
  rowsInFile: 123,
  rowsAnalyzed: 120,
  failedRowCount: 0,
  message: null,
  fallbacksByColumn: [],
  recommendedActions: null,
  outputs: { dashboard: null, pdf: null, slides: null },
  hasLegacyOutputs: false,
};

describe('pulse Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPulseOptions.current = {};
    mockUsePulse.mockReturnValue(idleHook);
    mockJobs.mockReturnValue({ data: { jobs: [] }, refetch: jest.fn() });
    mockResults.mockReturnValue({ data: undefined });
    mockModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', name: 'Opus 5', providerLabel: 'Anthropic' }] },
      isLoading: false,
    });
    mockParsePreview.mockResolvedValue({
      responseCount: 120,
      headers: [{ column: 'B', header: 'What did you think?', value: '' }],
      rows: [{ rowNumber: 2, responseText: 'good', cells: {} }],
    });
    mockDetectLayout.mockResolvedValue(LAYOUT);
    mockParse.mockResolvedValue({ fields: [], rowErrors: [], fileError: null });
    mockBuildMatrix.mockResolvedValue(new Blob(['matrix']));
    mockGate.mockImplementation(async (_modelId: string, submit: (id?: string) => Promise<void>) => {
      await submit(undefined);
      return true;
    });
    mockStartAnalysis.mockResolvedValue({ jobId: 'job-1', message: 'queued' });
  });

  // Mantine's Select opens and picks on mousedown; a full click event sequence costs ~700ms a call here.
  async function chooseModel() {
    fireEvent.mouseDown(screen.getByTestId('pulse-model'));
    fireEvent.mouseDown(screen.getByText('Opus 5'));
    await waitFor(() => {
      expect(screen.getByTestId('pulse-model')).toHaveValue('Opus 5');
    });
  }

  // Choosing a model unlocks every later step; the persona starts from the default.
  async function renderAgent() {
    const result = render(<Agent id='agent-1' />);

    await chooseModel();

    return result;
  }

  async function uploadSurvey(name = 'symposium.xlsx') {
    const expectedCalls = mockDetectLayout.mock.calls.length + 1;
    const file = new File(['x'], name);
    fireEvent.change(screen.getByTestId('pulse-survey-file-input'), { target: { files: [file] } });
    await waitFor(() => {
      expect(mockDetectLayout).toHaveBeenCalledTimes(expectedCalls);
    });
    await waitFor(() => {
      expect(screen.getByTestId('pulse-detected-layout')).toBeInTheDocument();
    });
  }

  async function uploadMatrix(name = 'matrix.xlsx') {
    const file = new File(['x'], name);
    fireEvent.change(screen.getByTestId('pulse-matrix-file-input'), { target: { files: [file] } });
    await waitFor(() => {
      expect(mockParse).toHaveBeenCalled();
    });
  }

  // A run needs the response count, which only exists once the survey has been read.
  async function awaitPreview() {
    await waitFor(() => {
      expect(screen.getByTestId('pulse-preview-count')).toBeInTheDocument();
    });
  }

  async function prepareRun() {
    mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
    await renderAgent();
    await uploadSurvey();
    await uploadMatrix();
    await awaitPreview();
    await waitFor(() => {
      expect(screen.getByTestId('pulse-submit')).toBeEnabled();
    });
  }

  describe('steps', () => {
    it('numbers the steps it renders in order', () => {
      render(<Agent id='agent-1' />);

      // Steps 5 and 6 belong to ConfigureForm, which has its own test.
      const numbers = screen.getAllByTestId(/^pulse-step-[a-z-]+-number$/).map((node) => node.textContent);

      expect(numbers).toEqual(['1', '2', '3', '4', '7']);
      expect(screen.getByTestId('pulse-step-template')).toBeInTheDocument();
      expect(screen.getByTestId('pulse-step-model')).toBeInTheDocument();
      expect(screen.getByTestId('pulse-step-survey')).toBeInTheDocument();
      expect(screen.getByTestId('pulse-step-matrix')).toBeInTheDocument();
      expect(screen.getByTestId('pulse-step-run')).toBeInTheDocument();
      expect(screen.getByTestId('pulse-configure-form')).toBeInTheDocument();
      expect(screen.getByTestId('pulse-test-panel')).toBeInTheDocument();
    });

    it('explains that setup is not saved and the session times out', () => {
      render(<Agent id='agent-1' />);

      const instructions = screen.getByTestId('pulse-template-instructions');

      expect(instructions).toHaveTextContent('Fill in the template in Excel.');
      expect(instructions).toHaveTextContent('setup isn\'t saved');
      expect(instructions).toHaveTextContent('about 15 minutes of inactivity');
    });

    it('keeps getting the template and choosing a model available from the start', () => {
      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-matrix-template-download')).toBeEnabled();
      expect(screen.getByTestId('pulse-model')).toBeEnabled();
    });

    it('keeps steps 3 to 7 disabled, and says why, until a model is chosen', async () => {
      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-survey-file-input')).toBeDisabled();
      expect(screen.getByTestId('pulse-matrix-file-input')).toBeDisabled();
      expect(screen.getByTestId('pulse-configure-form')).toHaveAttribute('data-disabled', 'true');
      expect(screen.getByTestId('pulse-submit')).toBeDisabled();
      expect(screen.getByTestId('pulse-step-survey-disabled-reason')).toHaveTextContent('Choose a model first.');
      expect(screen.getByTestId('pulse-step-run-disabled-reason')).toBeInTheDocument();

      await chooseModel();

      expect(screen.getByTestId('pulse-model')).toHaveValue('Opus 5');
      expect(screen.getByTestId('pulse-survey-file-input')).toBeEnabled();
      expect(screen.getByTestId('pulse-matrix-file-input')).toBeEnabled();
      expect(screen.getByTestId('pulse-configure-form')).toHaveAttribute('data-disabled', 'false');
      expect(screen.queryByTestId('pulse-step-survey-disabled-reason')).not.toBeInTheDocument();
    });
  });

  describe('template downloads', () => {
    it('downloads an empty template', async () => {
      render(<Agent id='agent-1' />);

      fireEvent.click(screen.getByTestId('pulse-matrix-template-download'));

      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'pulse-prompt-matrix-template.xlsx');
      });
      expect(mockBuildMatrix).toHaveBeenCalledWith([]);
    });

    // A previous run's columns are unlikely to match a new survey, so only the blank template is offered.
    it('offers the template as the only matrix download', () => {
      render(<Agent id='agent-1' />);

      expect(screen.getAllByTestId(/^pulse-matrix-.*-download$/)).toHaveLength(1);
      expect(screen.getByTestId('pulse-matrix-template-download')).toBeInTheDocument();
    });

    it('shows the cause and fix when a download fails', async () => {
      const error = new Error('The workbook couldn\'t be built.');
      mockBuildMatrix.mockRejectedValue(error);

      render(<Agent id='agent-1' />);

      fireEvent.click(screen.getByTestId('pulse-matrix-template-download'));

      await waitFor(() => expect(mockShowPulseError).toHaveBeenCalledWith(error, 'Download failed'));
    });
  });

  describe('persona and results focus', () => {
    it('starts from the default persona', () => {
      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-persona-value').textContent).toBe(PULSE_DEFAULT_PERSONA);
    });

    it('keeps what the user typed across a re-render', async () => {
      const { rerender } = await renderAgent();

      fireEvent.click(screen.getByTestId('pulse-type-persona'));
      expect(screen.getByTestId('pulse-persona-value')).toHaveTextContent('typed persona');

      rerender(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-persona-value')).toHaveTextContent('typed persona');
    });

    it('starts with no results focus', () => {
      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-focus-value')).toHaveTextContent('');
    });

    it('blocks the run and shows why when the persona is empty', async () => {
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-clear-persona'));
      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => expect(screen.getByTestId('pulse-persona-error')).toBeInTheDocument());
      expect(mockGate).not.toHaveBeenCalled();
    });

    it('blocks the run and shows why when the results focus is too long', async () => {
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-type-long-focus'));
      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => expect(screen.getByTestId('pulse-focus-error')).toBeInTheDocument());
      expect(mockGate).not.toHaveBeenCalled();
    });
  });

  describe('running', () => {
    it('routes a valid run through user group attribution with the chosen model and response count', async () => {
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => expect(mockGate).toHaveBeenCalledWith('model-1', expect.any(Function)));
      expect(mockStartAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        modelId: 'model-1',
        responseCount: 120,
      }));
    });

    it('sends the default persona, the results focus, and the matrix columns', async () => {
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-type-focus'));
      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => {
        expect(mockStartAnalysis).toHaveBeenCalledWith(expect.objectContaining({
          config: expect.objectContaining({
            persona: PULSE_DEFAULT_PERSONA,
            resultsFocus: 'Focus on regional differences.',
            fields: [FIELD],
          }),
        }));
      });
    });

    it('sends no results focus when none was written, and no response guidelines', async () => {
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => expect(mockStartAnalysis).toHaveBeenCalled());
      const { config } = mockStartAnalysis.mock.calls[0][0];

      expect(config.resultsFocus).toBeNull();
      expect(config).not.toHaveProperty('responseGuidelines');
      expect(config).not.toHaveProperty('modelId');
    });

    it('sends the worksheet and header row it read off the survey', async () => {
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => {
        expect(mockStartAnalysis).toHaveBeenCalledWith(expect.objectContaining({
          config: expect.objectContaining({ sheetName: 'Feedback', headerRow: 1 }),
        }));
      });
    });

    it('sends only the survey columns the matrix names', async () => {
      mockDetectLayout.mockResolvedValue(WIDE_LAYOUT);
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => {
        expect(mockStartAnalysis).toHaveBeenCalledWith(expect.objectContaining({
          config: expect.objectContaining({ inputColumns: ['B'] }),
        }));
      });
    });

    it('sends every survey column when a matrix column reads the whole response', async () => {
      mockDetectLayout.mockResolvedValue(WIDE_LAYOUT);
      mockParse.mockResolvedValue({
        fields: [FIELD, { ...FIELD, fieldName: 'Overall', inputColumnRefs: [], sortOrder: 1 }],
        rowErrors: [],
        fileError: null,
      });
      await renderAgent();
      await uploadSurvey();
      await uploadMatrix();
      await awaitPreview();

      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => {
        expect(mockStartAnalysis).toHaveBeenCalledWith(expect.objectContaining({
          config: expect.objectContaining({ inputColumns: ['A', 'B', 'C'] }),
        }));
      });
    });

    it('shows the cause and fix when the run cannot be started', async () => {
      const error = new Error('The analysis queue isn\'t running.\n\nFix: Try again in a few minutes; if it persists, ask an admin.');
      mockGate.mockRejectedValue(error);
      await prepareRun();

      fireEvent.click(screen.getByTestId('pulse-submit'));

      await waitFor(() => {
        expect(mockShowPulseError).toHaveBeenCalledWith(error, 'Couldn\'t start the analysis');
      });
    });

    it('cannot start a run before a prompt matrix is uploaded', async () => {
      await renderAgent();

      await uploadSurvey();

      expect(screen.getByTestId('pulse-submit')).toBeDisabled();
    });

    it('cannot start a run before a survey is uploaded', async () => {
      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      await renderAgent();

      await uploadMatrix();

      expect(screen.getByTestId('pulse-submit')).toBeDisabled();
    });

    it('lets a single response be tested once both files are ready', async () => {
      await prepareRun();

      expect(screen.getByTestId('pulse-test-run')).toBeEnabled();
    });

    it('shows the worker progress message while a run is in flight', () => {
      mockUsePulse.mockReturnValue({ ...idleHook, isProcessing: true, progress: 'Row 40 of 120' });

      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-progress')).toHaveTextContent('Row 40 of 120');
    });

    it('still names what is happening before the worker has reported any progress', () => {
      mockUsePulse.mockReturnValue({ ...idleHook, isProcessing: true, progress: '' });

      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-progress')).toHaveTextContent('Analyzing survey responses');
    });
  });

  describe('survey and matrix', () => {
    it('parses the chosen workbook locally as soon as its layout is read', async () => {
      await renderAgent();

      await uploadSurvey();

      await waitFor(() => expect(mockParsePreview).toHaveBeenCalled());
    });

    it('parses the matrix provisionally before a survey is loaded', async () => {
      await renderAgent();

      await uploadMatrix();

      expect(mockParse).toHaveBeenCalledWith(expect.anything(), []);
    });

    it('checks matrix source columns against the survey\'s letters and headers', async () => {
      mockDetectLayout.mockResolvedValue(WIDE_LAYOUT);
      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      await waitFor(() => {
        expect(mockParse).toHaveBeenLastCalledWith(expect.anything(), WIDE_LAYOUT.headers);
      });
    });

    it('re-parses the matrix against the columns of a second survey', async () => {
      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      mockDetectLayout.mockResolvedValue(WIDE_LAYOUT);
      await uploadSurvey('second-survey.xlsx');

      await waitFor(() => {
        expect(mockParse.mock.calls.at(-1)?.[1]).toEqual(WIDE_LAYOUT.headers);
      });
    });

    it('counts the parsed columns without listing them one by one', async () => {
      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();
      await awaitPreview();

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-summary')).toHaveTextContent('1');
      });
      expect(screen.queryByTestId('pulse-matrix-preview-source')).not.toBeInTheDocument();
    });

    it('cannot start a run when the matrix workbook is unusable', async () => {
      mockParse.mockResolvedValue({ fields: [], rowErrors: [], fileError: 'The prompt matrix has no rows with both a column name and a prompt.' });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-file-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pulse-submit')).toBeDisabled();
    });

    it('can still start a run when some matrix rows were skipped', async () => {
      mockParse.mockResolvedValue({
        fields: [FIELD],
        rowErrors: [{ row: 4, message: '\'Nonexistent\' doesn\'t match any survey column.\n\nFix: Use a column letter or one of: B – What did you think?' }],
        fileError: null,
      });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-row-error')).toHaveTextContent('Nonexistent');
      });
      expect(screen.getByTestId('pulse-matrix-row-error')).toHaveTextContent('Fix: Use a column letter');
      await waitFor(() => expect(screen.getByTestId('pulse-submit')).toBeEnabled());
    });

    it('shows the problem when the matrix file cannot be read at all', async () => {
      mockParse.mockRejectedValue(new Error('The prompt matrix couldn\'t be read as an Excel workbook.'));
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-file-error')).toHaveTextContent('Excel workbook');
      });
      expect(screen.getByTestId('pulse-matrix-file-input')).toBeEnabled();
    });

    it('replaces the error with the new columns once a readable matrix is chosen', async () => {
      mockParse.mockRejectedValueOnce(new Error('The prompt matrix couldn\'t be read as an Excel workbook.'));
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-file-error')).toBeInTheDocument();
      });

      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      const second = new File(['x'], 'second-matrix.xlsx');
      fireEvent.change(screen.getByTestId('pulse-matrix-file-input'), { target: { files: [second] } });

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-summary')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('pulse-matrix-file-error')).not.toBeInTheDocument();
    });

    it('clears the previous matrix when the file is removed', async () => {
      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();

      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-summary')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('pulse-matrix-file-input'), { target: { files: [] } });

      await waitFor(() => {
        expect(screen.queryByTestId('pulse-matrix-summary')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('pulse-submit')).toBeDisabled();
    });

    it('hides the previous columns and blocks the run while a new matrix is parsing', async () => {
      mockParse.mockResolvedValue({ fields: [FIELD], rowErrors: [], fileError: null });
      await renderAgent();

      await uploadSurvey();
      await uploadMatrix();
      await waitFor(() => {
        expect(screen.getByTestId('pulse-matrix-summary')).toBeInTheDocument();
      });

      let resolveSecondParse: (value: unknown) => void = () => {};
      mockParse.mockImplementationOnce(() => new Promise((resolve) => { resolveSecondParse = resolve; }));

      const second = new File(['x'], 'second-matrix.xlsx');
      fireEvent.change(screen.getByTestId('pulse-matrix-file-input'), { target: { files: [second] } });

      await waitFor(() => {
        expect(screen.queryByTestId('pulse-matrix-summary')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('pulse-submit')).toBeDisabled();

      await act(async () => {
        resolveSecondParse({ fields: [FIELD], rowErrors: [], fileError: null });
      });

      expect(screen.getByTestId('pulse-matrix-summary')).toBeInTheDocument();
    });

    it('re-reads the survey against the worksheet the user picks', async () => {
      await renderAgent();

      await uploadSurvey();

      mockDetectLayout.mockResolvedValue({
        ...LAYOUT,
        sheetName: 'Round two',
        headerRow: 2,
        columns: ['C'],
        headers: [{ letter: 'C', header: 'Revenue' }],
        sheetNames: ['Feedback', 'Round two'],
      });
      fireEvent.click(screen.getByTestId('pulse-pick-sheet'));

      await waitFor(() => {
        expect(mockDetectLayout).toHaveBeenLastCalledWith(expect.anything(), 'Round two');
      });
      await waitFor(() => {
        expect(screen.getByTestId('pulse-detected-layout')).toHaveTextContent('Round two:2');
      });
    });

    it('re-reads the layout for a second survey', async () => {
      await renderAgent();

      await uploadSurvey();

      mockDetectLayout.mockResolvedValue({ ...LAYOUT, sheetName: 'Round two', headerRow: 3 });
      await uploadSurvey('second-survey.xlsx');

      await waitFor(() => {
        expect(screen.getByTestId('pulse-detected-layout')).toHaveTextContent('Round two:3');
      });
    });

    it('shows the problem when the survey workbook cannot be read at all', async () => {
      mockDetectLayout.mockRejectedValue(new Error('The survey couldn\'t be read as an Excel workbook.'));
      await renderAgent();

      const file = new File(['x'], 'charts-only.xlsx');
      fireEvent.change(screen.getByTestId('pulse-survey-file-input'), { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('pulse-preview-error')).toHaveTextContent('Excel workbook');
      });
      expect(screen.queryByTestId('pulse-preview-count')).not.toBeInTheDocument();
    });

    it('surfaces a parse failure instead of silently showing no preview', async () => {
      mockParsePreview.mockRejectedValue(new Error('The worksheet \'Feedback\' isn\'t in the uploaded survey.'));
      await renderAgent();

      await uploadSurvey();

      await waitFor(() => expect(screen.getByTestId('pulse-preview-error'))
        .toHaveTextContent('isn\'t in the uploaded survey'));
      expect(screen.queryByTestId('pulse-preview-count')).not.toBeInTheDocument();
    });

    it('keeps the newest preview when an older parse finishes after it', async () => {
      let resolveStale: (preview: unknown) => void = () => {};
      mockParsePreview
        .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve; }))
        .mockResolvedValueOnce({ responseCount: 7, headers: [], rows: [] });

      await renderAgent();

      await uploadSurvey();
      mockDetectLayout.mockResolvedValue({ ...LAYOUT, sheetName: 'Round two', columns: ['C'], headers: [{ letter: 'C', header: 'Revenue' }] });
      fireEvent.click(screen.getByTestId('pulse-pick-sheet'));

      await waitFor(() => expect(screen.getByTestId('pulse-preview-count')).toHaveTextContent('7'));

      await act(async () => {
        resolveStale({ responseCount: 999, headers: [], rows: [] });
      });

      expect(screen.getByTestId('pulse-preview-count')).toHaveTextContent('7');
    });

    it('keeps the newest preview when an older parse fails after it', async () => {
      let rejectStale: (error: Error) => void = () => {};
      mockParsePreview
        .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectStale = reject; }))
        .mockResolvedValueOnce({ responseCount: 7, headers: [], rows: [] });

      await renderAgent();

      await uploadSurvey();
      mockDetectLayout.mockResolvedValue({ ...LAYOUT, sheetName: 'Round two', columns: ['C'], headers: [{ letter: 'C', header: 'Revenue' }] });
      fireEvent.click(screen.getByTestId('pulse-pick-sheet'));

      await waitFor(() => expect(screen.getByTestId('pulse-preview-count')).toHaveTextContent('7'));

      await act(async () => {
        rejectStale(new Error('The worksheet \'Feedback\' isn\'t in the uploaded survey.'));
      });

      expect(screen.getByTestId('pulse-preview-count')).toHaveTextContent('7');
      expect(screen.queryByTestId('pulse-preview-error')).not.toBeInTheDocument();
    });
  });

  describe('results', () => {
    it('prompts for a survey upload when there are no finished runs', () => {
      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('pulse-process-dashboard')).not.toBeInTheDocument();
    });

    it('offers a run picker once there is a finished run', () => {
      mockJobs.mockReturnValue({ data: { jobs: [completedJob] }, refetch: jest.fn() });

      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-job-picker')).toBeInTheDocument();
    });

    it('lists completed and failed runs, labels the failed one, and leaves out runs still processing', () => {
      mockJobs.mockReturnValue({ data: { jobs: [completedJob, failedJob, processingJob] }, refetch: jest.fn() });

      render(<Agent id='agent-1' />);

      fireEvent.mouseDown(screen.getByTestId('pulse-job-picker'));

      const options = screen.getAllByRole('option');

      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('120 responses');
      expect(options[1]).toHaveTextContent('Failed');
    });

    it('shows the process dashboard for the run that just finished', () => {
      mockJobs.mockReturnValue({ data: { jobs: [completedJob] }, refetch: jest.fn() });
      mockUsePulse.mockReturnValue({
        ...idleHook,
        completedJobId: 'job-1',
        resultsData: { run: RUN_VIEW, fields: [], results: [] },
      });

      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-process-dashboard')).toHaveTextContent('succeeded');
    });

    it('shows the process dashboard for a picked failed run', async () => {
      const failedRun: PulseRunView = {
        ...RUN_VIEW,
        id: 'job-2',
        status: 'failed',
        surveyFilename: 'broken.xlsx',
        message: { cause: 'Extraction failed', fix: null },
      };

      mockJobs.mockReturnValue({ data: { jobs: [completedJob, failedJob] }, refetch: jest.fn() });
      mockResults.mockReturnValue({ data: { run: failedRun, fields: [], results: [] } });

      render(<Agent id='agent-1' />);

      fireEvent.mouseDown(screen.getByTestId('pulse-job-picker'));
      fireEvent.mouseDown(screen.getByText(/Failed/));

      await waitFor(() => {
        expect(screen.getByTestId('pulse-process-dashboard')).toHaveTextContent('failed');
      });
    });

    it('shows the cause and fix when a run errors out', () => {
      mockUsePulse.mockReturnValue({
        ...idleHook,
        jobStatus: 'error',
        error: 'The worksheet \'Feedback\' isn\'t in the uploaded survey.\n\nFix: Pick a worksheet from the list, or re-upload the file it came from.',
      });

      render(<Agent id='agent-1' />);

      expect(screen.getByTestId('pulse-error-cause')).toHaveTextContent('isn\'t in the uploaded survey');
      expect(screen.getByTestId('pulse-error-fix')).toHaveTextContent('Pick a worksheet from the list');
    });

    it('refreshes the run list when a run fails, so it can be picked', () => {
      const refetch = jest.fn();
      mockJobs.mockReturnValue({ data: { jobs: [] }, refetch });
      mockUsePulse.mockReturnValue({ ...idleHook, jobStatus: 'error', error: 'The run stopped before it finished.' });

      render(<Agent id='agent-1' />);

      expect(refetch).toHaveBeenCalled();
    });

    it('shows a failed run\'s cause and fix as a notification', () => {
      render(<Agent id='agent-1' />);

      act(() => {
        mockPulseOptions.current.onError?.('The run stopped before it finished.\n\nFix: Run it again.');
      });

      expect(mockShowPulseError).toHaveBeenCalledWith(expect.any(Error), 'Survey analysis failed');
      expect((mockShowPulseError.mock.calls[0][0] as Error).message).toBe('The run stopped before it finished.\n\nFix: Run it again.');
    });
  });
});
