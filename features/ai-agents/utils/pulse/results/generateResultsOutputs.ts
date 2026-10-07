import logger from '@/server/logger';
import { createErrorAuditor } from '@/server/errorAuditor';
import { PULSE_QUEUE_NAME } from '@/features/ai-agents/utils/pulse/worker/queue';
import buildBreakdowns from '@/features/ai-agents/utils/pulse/results/buildBreakdowns';
import renderInteractiveDashboard from '@/features/ai-agents/utils/pulse/results/dashboard/renderInteractiveDashboard';
import generateNarrative from '@/features/ai-agents/utils/pulse/results/generateNarrative';
import profileColumns from '@/features/ai-agents/utils/pulse/results/profileColumns';
import renderExecutiveSummary from '@/features/ai-agents/utils/pulse/results/renderExecutiveSummary';
import PdfRendererUnavailableError from '@/features/ai-agents/utils/pulse/results/pdfRendererError';
import renderPdf from '@/features/ai-agents/utils/pulse/results/renderPdf';
import renderSlides from '@/features/ai-agents/utils/pulse/results/renderSlides';
import sampleQuotes from '@/features/ai-agents/utils/pulse/results/sampleQuotes';
import type { PulseCompletionAdapter } from '@/features/ai-agents/utils/pulse/worker/extractRow';
import type { ParsedSurveyRow } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type {
  PulseOutputErrors,
  PulseReportInput,
  PulseResultsOutputs,
  PulseResultsProfile,
  PulseRunFacts,
  PulseSurveyColumn,
  PulseToolColumn,
} from '@/features/ai-agents/types/pulse/results';

export const PROFILE_FAILED_REASON = 'The survey columns couldn\'t be profiled, so this output wasn\'t built.';
export const NARRATIVE_FAILED_REASON = 'The written summary couldn\'t be generated for this run.';
export const DASHBOARD_FAILED_REASON = 'The results dashboard couldn\'t be built for this run.';
export const SLIDES_FAILED_REASON = 'The slides couldn\'t be built for this run.';
export const SUMMARY_FAILED_REASON = 'The executive summary couldn\'t be built for this run.';
export const PDF_RENDERER_UNAVAILABLE_REASON = 'The server\'s PDF renderer isn\'t available, so the executive summary PDF wasn\'t created. Ask an admin to check Chromium on the server.';
export const PDF_RENDER_FAILED_REASON = 'The executive summary PDF couldn\'t be rendered. Try running the survey again; if it keeps failing, ask an admin to check the server\'s PDF renderer.';

export type GenerateResultsOutputsParams = {
  jobId: string;
  userId: string;
  facts: PulseRunFacts;
  rows: ParsedSurveyRow[];
  surveyColumns: PulseSurveyColumn[];
  toolColumns: PulseToolColumn[];
  persona: string;
  resultsFocus: string | null;
  completionAdapter: PulseCompletionAdapter;
  onProgress: (progress: string) => Promise<void>;
};

// Which run a failed step belongs to and whose it was, so it can be logged and audited together.
type StepContext = {
  jobId: string;
  userId: string;
};

/**
 * A step failure never fails the run, so it never reaches the worker's failed handler. The user
 * is told which output is missing; the error record is how an admin finds out what broke.
 */
function auditStepFailure(context: StepContext, step: string, error: unknown): void {
  createErrorAuditor({ userId: context.userId }).createErrorRecord({
    source: 'background-job',
    route: PULSE_QUEUE_NAME,
    code: 'PULSE_RESULTS_STEP_FAILED',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null,
    metadata: { jobId: context.jobId, step },
  });
}

function logStepFailure(context: StepContext, step: string, error: unknown): void {
  logger.error('PULSE results step failed', {
    jobId: context.jobId,
    step,
    error: error instanceof Error ? error.message : String(error),
  });
  auditStepFailure(context, step, error);
}

// null means the step failed and was recorded; every output here is non-null on success.
function runStep<T>(context: StepContext, step: string, work: () => T): T | null {
  try {
    return work();
  } catch (error) {
    logStepFailure(context, step, error);
    return null;
  }
}

async function runAsyncStep<T>(context: StepContext, step: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    logStepFailure(context, step, error);
    return null;
  }
}

/**
 * A missing renderer is the admin's problem and a failed print is worth retrying, so the two
 * are told apart rather than both reading as Chromium being absent.
 */
async function printSummaryPdf(
  context: StepContext,
  html: string,
): Promise<{ pdf: Buffer | null; reason: string | null }> {
  try {
    return { pdf: await renderPdf(html), reason: null };
  } catch (error) {
    logStepFailure(context, 'pdf', error);

    return {
      pdf: null,
      reason: error instanceof PdfRendererUnavailableError
        ? PDF_RENDERER_UNAVAILABLE_REASON
        : PDF_RENDER_FAILED_REASON,
    };
  }
}

async function reportProgress(params: GenerateResultsOutputsParams, progress: string): Promise<void> {
  await runAsyncStep(
    { jobId: params.jobId, userId: params.userId },
    'progress',
    () => params.onProgress(progress),
  );
}

function profileFailure(): PulseResultsOutputs {
  return {
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
  };
}

/**
 * Builds every end-of-run output. Each step is isolated so one failure records a reason for
 * its output and the rest still render; it never rejects, so outputs can't fail the run.
 */
export default async function generateResultsOutputs(
  params: GenerateResultsOutputsParams,
): Promise<PulseResultsOutputs> {
  const { jobId, userId, facts, rows, surveyColumns, toolColumns, persona, resultsFocus, completionAdapter } = params;
  const step: StepContext = { jobId, userId };
  const errors: PulseOutputErrors = {};

  const columns = runStep(step, 'profile', () => profileColumns({
    surveyColumns,
    toolColumns,
    rowCount: rows.length,
  }));

  if (columns === null) {
    return profileFailure();
  }

  const profile: PulseResultsProfile = {
    columns,
    breakdowns: runStep(step, 'breakdowns', () => buildBreakdowns({ profiles: columns, surveyColumns, toolColumns })) ?? [],
    quotes: runStep(step, 'quotes', () => sampleQuotes({
      profiles: columns,
      surveyColumns,
      toolColumns,
      rowNumbers: rows.map((row) => row.rowNumber),
    })) ?? [],
  };

  await reportProgress(params, 'Writing the results narrative…');

  const written = await runAsyncStep(step, 'narrative', () => generateNarrative({
    facts,
    profile,
    persona,
    resultsFocus,
    completionAdapter,
  }));
  const narrative = written?.narrative ?? null;

  if (narrative === null) {
    logger.warn('PULSE results narrative unavailable', { jobId, error: written?.error ?? null });

    // A thrown failure was recorded by the step runner; one the model call handled itself was not.
    if (written !== null) {
      auditStepFailure(step, 'narrative', written.error ?? NARRATIVE_FAILED_REASON);
    }

    errors.narrative = NARRATIVE_FAILED_REASON;
  }

  await reportProgress(params, 'Building the results outputs…');

  const input: PulseReportInput = { facts, profile, narrative };

  const dashboardHtml = runStep(step, 'dashboard', () => renderInteractiveDashboard(input));

  if (dashboardHtml === null) {
    errors.dashboard = DASHBOARD_FAILED_REASON;
  }

  const slidesHtml = runStep(step, 'slides', () => renderSlides(input));

  if (slidesHtml === null) {
    errors.slides = SLIDES_FAILED_REASON;
  }

  const summaryHtml = runStep(step, 'executiveSummary', () => renderExecutiveSummary(input));
  let executiveSummaryPdf: Buffer | null = null;

  if (summaryHtml === null) {
    errors.pdf = SUMMARY_FAILED_REASON;
  } else {
    const printed = await printSummaryPdf(step, summaryHtml);

    executiveSummaryPdf = printed.pdf;

    if (printed.reason !== null) {
      errors.pdf = printed.reason;
    }
  }

  return { profile, narrative, dashboardHtml, slidesHtml, executiveSummaryPdf, errors };
}
