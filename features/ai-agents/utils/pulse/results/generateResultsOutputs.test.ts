import generateResultsOutputs, {
  DASHBOARD_FAILED_REASON,
  NARRATIVE_FAILED_REASON,
  PDF_RENDERER_UNAVAILABLE_REASON,
  PDF_RENDER_FAILED_REASON,
  PROFILE_FAILED_REASON,
  SLIDES_FAILED_REASON,
  SUMMARY_FAILED_REASON,
  type GenerateResultsOutputsParams,
} from '@/features/ai-agents/utils/pulse/results/generateResultsOutputs';
import { createErrorAuditor, type ErrorAuditorDetails } from '@/server/errorAuditor';
import PdfRendererUnavailableError from '@/features/ai-agents/utils/pulse/results/pdfRendererError';
import buildBreakdowns from '@/features/ai-agents/utils/pulse/results/buildBreakdowns';
import generateNarrative from '@/features/ai-agents/utils/pulse/results/generateNarrative';
import profileColumns from '@/features/ai-agents/utils/pulse/results/profileColumns';
import renderExecutiveSummary from '@/features/ai-agents/utils/pulse/results/renderExecutiveSummary';
import renderPdf from '@/features/ai-agents/utils/pulse/results/renderPdf';
import renderInteractiveDashboard from '@/features/ai-agents/utils/pulse/results/dashboard/renderInteractiveDashboard';
import renderSlides from '@/features/ai-agents/utils/pulse/results/renderSlides';
import sampleQuotes from '@/features/ai-agents/utils/pulse/results/sampleQuotes';
import type { PulseCompletionAdapter } from '@/features/ai-agents/utils/pulse/worker/extractRow';
import {
  PulseFieldType,
  type ParsedSurveyRow,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type {
  PulseBreakdown,
  PulseColumnProfile,
  PulseNarrative,
  PulseQuote,
  PulseRunFacts,
  PulseSurveyColumn,
  PulseToolColumn,
} from '@/features/ai-agents/types/pulse/results';

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/server/errorAuditor', () => ({
  createErrorAuditor: jest.fn(() => ({ createErrorRecord: mockCreateErrorRecord })),
}));
jest.mock('@/features/ai-agents/utils/pulse/results/profileColumns', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/buildBreakdowns', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/sampleQuotes', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/generateNarrative', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/dashboard/renderInteractiveDashboard', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/renderExecutiveSummary', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/renderSlides', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/ai-agents/utils/pulse/results/renderPdf', () => ({ __esModule: true, default: jest.fn() }));

const mockCreateErrorRecord = jest.fn<Promise<void>, [ErrorAuditorDetails]>();
const mockProfileColumns = jest.mocked(profileColumns);
const mockBuildBreakdowns = jest.mocked(buildBreakdowns);
const mockSampleQuotes = jest.mocked(sampleQuotes);
const mockGenerateNarrative = jest.mocked(generateNarrative);
const mockRenderDashboard = jest.mocked(renderInteractiveDashboard);
const mockRenderSummary = jest.mocked(renderExecutiveSummary);
const mockRenderSlides = jest.mocked(renderSlides);
const mockRenderPdf = jest.mocked(renderPdf);

const facts: PulseRunFacts = {
  surveyFilename: 'symposium.xlsx',
  modelName: 'Claude Opus 5',
  completedAt: new Date('2026-09-25T12:00:00Z'),
  rowsInFile: 2,
  rowsAnalyzed: 2,
  failedRowCount: 0,
};

const rows: ParsedSurveyRow[] = [
  {
    rowNumber: 2,
    cells: { B: { column: 'B', header: 'What worked?', value: 'The mentoring' } },
    responseText: 'The mentoring',
  },
  {
    rowNumber: 3,
    cells: { B: { column: 'B', header: 'What worked?', value: 'The venue' } },
    responseText: 'The venue',
  },
];

const surveyColumns: PulseSurveyColumn[] = [
  { letter: 'B', header: 'What worked?', values: ['The mentoring', 'The venue'] },
];

const toolColumns: PulseToolColumn[] = [{
  fieldName: 'Sentiment',
  fieldType: PulseFieldType.CATEGORY,
  allowedValues: ['Positive', 'Neutral'],
  values: ['Positive', 'Neutral'],
}];

const columns: PulseColumnProfile[] = [
  {
    key: 'survey:B',
    label: 'B – What worked?',
    source: 'survey',
    answeredCount: 2,
    rowCount: 2,
    fallbackCount: 0,
    kind: 'freeText',
  },
  {
    key: 'tool:Sentiment',
    label: 'Sentiment',
    source: 'tool',
    answeredCount: 2,
    rowCount: 2,
    fallbackCount: 0,
    kind: 'categorical',
    counts: [{ value: 'Positive', count: 1 }, { value: 'Neutral', count: 1 }],
  },
];

const breakdowns: PulseBreakdown[] = [];

const quotes: PulseQuote[] = [{
  id: 'q1',
  rowNumber: 2,
  columnKey: 'survey:B',
  columnLabel: 'B – What worked?',
  text: 'The mentoring',
}];

const narrative: PulseNarrative = {
  headline: 'Mentoring carried the symposium.',
  overview: 'Respondents valued the mentoring sessions.',
  keyFindings: [{
    title: 'Mentoring',
    detail: 'Half were positive.',
    columns: ['Sentiment'],
    quoteIds: [],
    tone: 'positive',
    whyItMatters: null,
    caveat: null,
  }],
  recommendedActions: [{ action: 'Expand mentoring', rationale: 'It drew the most praise.', finding: 1 }],
  columnNotes: { Sentiment: 'Evenly split.' },
  featuredColumns: ['Sentiment'],
  quoteIds: ['q1'],
};

const pdf = Buffer.from('%PDF-1.7');
const completionAdapter = { chat: jest.fn() } as unknown as PulseCompletionAdapter;
const steps: string[] = [];
const onProgress = jest.fn(async (progress: string): Promise<void> => {
  steps.push(progress);
});

function params(overrides: Partial<GenerateResultsOutputsParams> = {}): GenerateResultsOutputsParams {
  return {
    jobId: 'job-1',
    userId: 'user-1',
    facts,
    rows,
    surveyColumns,
    toolColumns,
    persona: 'You analyze symposium feedback.',
    resultsFocus: 'Mentoring',
    completionAdapter,
    onProgress,
    ...overrides,
  };
}

describe('generateResultsOutputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    steps.length = 0;

    mockProfileColumns.mockReturnValue(columns);
    mockBuildBreakdowns.mockReturnValue(breakdowns);
    mockSampleQuotes.mockReturnValue(quotes);
    mockGenerateNarrative.mockImplementation(async () => {
      steps.push('narrative');
      return { narrative, error: null };
    });
    mockRenderDashboard.mockImplementation(() => {
      steps.push('dashboard');
      return '<html>dashboard</html>';
    });
    mockRenderSummary.mockReturnValue('<html>summary</html>');
    mockRenderSlides.mockReturnValue('<html>slides</html>');
    mockRenderPdf.mockResolvedValue(pdf);
  });

  it('profiles every survey and tool column against one row count', async () => {
    await generateResultsOutputs(params());

    expect(mockProfileColumns).toHaveBeenCalledWith({ surveyColumns, toolColumns, rowCount: 2 });
  });

  it('returns every output when each step works', async () => {
    await expect(generateResultsOutputs(params())).resolves.toEqual({
      profile: { columns, breakdowns, quotes },
      narrative,
      dashboardHtml: '<html>dashboard</html>',
      slidesHtml: '<html>slides</html>',
      executiveSummaryPdf: pdf,
      errors: {},
    });
  });

  it('builds breakdowns from the profiled columns', async () => {
    await generateResultsOutputs(params());

    expect(mockBuildBreakdowns).toHaveBeenCalledWith({ profiles: columns, surveyColumns, toolColumns });
  });

  it('samples quotes from the profiled columns, numbered by survey row', async () => {
    await generateResultsOutputs(params());

    expect(mockSampleQuotes).toHaveBeenCalledWith({
      profiles: columns,
      surveyColumns,
      toolColumns,
      rowNumbers: [2, 3],
    });
  });

  it('writes the narrative from the profile, persona, and results focus', async () => {
    await generateResultsOutputs(params());

    expect(mockGenerateNarrative).toHaveBeenCalledWith({
      facts,
      profile: { columns, breakdowns, quotes },
      persona: 'You analyze symposium feedback.',
      resultsFocus: 'Mentoring',
      completionAdapter,
    });
  });

  it('reports the narrative step, then the output step', async () => {
    await generateResultsOutputs(params());

    expect(steps).toEqual([
      'Writing the results narrative…',
      'narrative',
      'Building the results outputs…',
      'dashboard',
    ]);
  });

  it('prints the executive summary into the PDF', async () => {
    await generateResultsOutputs(params());

    expect(mockRenderPdf).toHaveBeenCalledWith('<html>summary</html>');
  });

  it('still builds every output from the numbers when the narrative comes back unusable', async () => {
    mockGenerateNarrative.mockResolvedValue({ narrative: null, error: 'Unexpected token } in JSON' });

    const outputs = await generateResultsOutputs(params());

    expect(outputs.errors).toEqual({ narrative: NARRATIVE_FAILED_REASON });
    expect(outputs.dashboardHtml).toBe('<html>dashboard</html>');
    expect(mockRenderDashboard).toHaveBeenCalledWith({
      facts,
      profile: { columns, breakdowns, quotes },
      narrative: null,
    });
  });

  it('treats a narrative call that threw like one that came back unusable', async () => {
    mockGenerateNarrative.mockRejectedValue(new Error('ThrottlingException'));

    const outputs = await generateResultsOutputs(params());

    expect(outputs.narrative).toBeNull();
    expect(outputs.errors).toEqual({ narrative: NARRATIVE_FAILED_REASON });
    expect(outputs.slidesHtml).toBe('<html>slides</html>');
  });

  // Review Focus: Chromium missing or crashing.
  it('keeps the dashboard and slides when the server cannot launch Chromium for the PDF', async () => {
    mockRenderPdf.mockRejectedValue(new PdfRendererUnavailableError('Failed to launch the browser process!'));

    const outputs = await generateResultsOutputs(params());

    expect(outputs.executiveSummaryPdf).toBeNull();
    expect(outputs.errors).toEqual({ pdf: PDF_RENDERER_UNAVAILABLE_REASON });
    expect(outputs.dashboardHtml).toBe('<html>dashboard</html>');
    expect(outputs.slidesHtml).toBe('<html>slides</html>');
  });

  // Nothing is wrong with the server when one print fails, so the run is worth repeating.
  it('offers a retry rather than blaming the renderer when printing the PDF fails', async () => {
    mockRenderPdf.mockRejectedValue(new Error('Page crashed!'));

    const outputs = await generateResultsOutputs(params());

    expect(outputs.executiveSummaryPdf).toBeNull();
    expect(outputs.errors).toEqual({ pdf: PDF_RENDER_FAILED_REASON });
    expect(outputs.errors.pdf).not.toContain('Ask an admin');
  });

  it('records a dashboard that failed to render without losing the other outputs', async () => {
    mockRenderDashboard.mockImplementation(() => {
      throw new Error('Cannot read properties of undefined');
    });

    const outputs = await generateResultsOutputs(params());

    expect(outputs.dashboardHtml).toBeNull();
    expect(outputs.errors).toEqual({ dashboard: DASHBOARD_FAILED_REASON });
    expect(outputs.slidesHtml).toBe('<html>slides</html>');
    expect(outputs.executiveSummaryPdf).toBe(pdf);
  });

  it('records slides that failed to render without losing the other outputs', async () => {
    mockRenderSlides.mockImplementation(() => {
      throw new Error('Cannot read properties of undefined');
    });

    const outputs = await generateResultsOutputs(params());

    expect(outputs.slidesHtml).toBeNull();
    expect(outputs.errors).toEqual({ slides: SLIDES_FAILED_REASON });
    expect(outputs.dashboardHtml).toBe('<html>dashboard</html>');
  });

  it('skips the PDF when the executive summary itself failed to render', async () => {
    mockRenderSummary.mockImplementation(() => {
      throw new Error('Cannot read properties of undefined');
    });

    const outputs = await generateResultsOutputs(params());

    expect(outputs.errors).toEqual({ pdf: SUMMARY_FAILED_REASON });
    expect(mockRenderPdf).not.toHaveBeenCalled();
  });

  it('records every output as missing when the columns cannot be profiled', async () => {
    mockProfileColumns.mockImplementation(() => {
      throw new Error('Invalid array length');
    });

    const outputs = await generateResultsOutputs(params());

    expect(outputs).toEqual({
      profile: { columns: [], breakdowns: [], quotes: [] },
      narrative: null,
      dashboardHtml: null,
      slidesHtml: null,
      executiveSummaryPdf: null,
      errors: {
        narrative: PROFILE_FAILED_REASON,
        dashboard: PROFILE_FAILED_REASON,
        pdf: PROFILE_FAILED_REASON,
        slides: PROFILE_FAILED_REASON,
      },
    });
    expect(mockGenerateNarrative).not.toHaveBeenCalled();
  });

  it('goes on without breakdowns or quotes when either of those steps fails', async () => {
    mockBuildBreakdowns.mockImplementation(() => {
      throw new Error('boom');
    });
    mockSampleQuotes.mockImplementation(() => {
      throw new Error('boom');
    });

    const outputs = await generateResultsOutputs(params());

    expect(outputs.profile).toEqual({ columns, breakdowns: [], quotes: [] });
    expect(outputs.errors).toEqual({});
  });

  it('finishes even when a progress update cannot be written', async () => {
    onProgress.mockRejectedValueOnce(new Error('Redis connection lost'));

    const outputs = await generateResultsOutputs(params());

    expect(outputs.dashboardHtml).toBe('<html>dashboard</html>');
  });

  // A lost output never fails the run, so the error log is the only place an admin can see why.
  describe('error records', () => {
    it('records a failed step under the run and the user it belongs to', async () => {
      mockRenderPdf.mockRejectedValue(new PdfRendererUnavailableError('Failed to launch the browser process!'));

      await generateResultsOutputs(params());

      expect(createErrorAuditor).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(mockCreateErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
        source: 'background-job',
        code: 'PULSE_RESULTS_STEP_FAILED',
        message: 'Failed to launch the browser process!',
        metadata: { jobId: 'job-1', step: 'pdf' },
      }));
    });

    it('records a narrative the model handed back unusable, which never throws', async () => {
      mockGenerateNarrative.mockResolvedValue({ narrative: null, error: 'Unexpected token } in JSON' });

      await generateResultsOutputs(params());

      expect(mockCreateErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Unexpected token } in JSON',
        metadata: { jobId: 'job-1', step: 'narrative' },
      }));
    });

    it('records a narrative that threw once, not twice', async () => {
      mockGenerateNarrative.mockRejectedValue(new Error('ThrottlingException'));

      await generateResultsOutputs(params());

      const narrativeRecords = mockCreateErrorRecord.mock.calls
        .filter(([details]) => details.metadata?.step === 'narrative');

      expect(narrativeRecords).toHaveLength(1);
    });

    it('writes nothing when every step works', async () => {
      await generateResultsOutputs(params());

      expect(mockCreateErrorRecord).not.toHaveBeenCalled();
    });
  });
});
