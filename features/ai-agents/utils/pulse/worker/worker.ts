import { Worker } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';
import { storage } from '@/server/storage/redis';
import logger from '@/server/logger';
import { reportJobFailure } from '@/server/reportJobFailure';
import {
  DEFAULT_WORKER_CONFIG,
  WORKER_SHUTDOWN_TIMEOUT,
} from '@/features/ai-agents/utils/shared/types';
import { AIFactory } from '@/features/ai-provider/factory';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import type { StorageProvider } from '@/features/document-upload-provider/sources/types';
import countFullyDefaultedRows from '@/features/ai-agents/dal/pulse/countFullyDefaultedRows';
import getPulseJob from '@/features/ai-agents/dal/pulse/getPulseJob';
import getProcessedRowNumbers from '@/features/ai-agents/dal/pulse/getProcessedRowNumbers';
import getPulseJobStatus from '@/features/ai-agents/dal/pulse/getPulseJobStatus';
import getPulseResults from '@/features/ai-agents/dal/pulse/getPulseResults';
import savePulseResult from '@/features/ai-agents/dal/pulse/savePulseResult';
import updatePulseJobOutputs from '@/features/ai-agents/dal/pulse/updatePulseJobOutputs';
import updatePulseJobResponseCount from '@/features/ai-agents/dal/pulse/updatePulseJobResponseCount';
import updatePulseJobStatus from '@/features/ai-agents/dal/pulse/updatePulseJobStatus';
import {
  PulseUserError,
  formatPulseError,
  parsePulseErrorMessage,
  stoppedUnexpectedlyError,
  storageUnavailableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import { PULSE_OUTPUT_FILE_KINDS } from '@/features/ai-agents/utils/pulse/outputReasons';
import buildToolColumns from '@/features/ai-agents/utils/pulse/results/buildToolColumns';
import generateResultsOutputs from '@/features/ai-agents/utils/pulse/results/generateResultsOutputs';
import extractRowValues from '@/features/ai-agents/utils/pulse/worker/extractRow';
import parseSurveySpreadsheet from '@/features/ai-agents/utils/pulse/worker/parseSurveySpreadsheet';
import { toResultCells } from '@/features/ai-agents/utils/pulse/readSurveyRows';
import { PULSE_QUEUE_NAME } from '@/features/ai-agents/utils/pulse/worker/queue';
import type { PulseJobData } from '@/features/ai-agents/utils/pulse/worker/queue';
import type { PulseOutputErrors } from '@/features/ai-agents/types/pulse/results';
import type {
  ParsedSurveyRow,
  PulseExtractedValue,
  PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

// A 120-row survey is one model call per row plus retries, so the default
// five-minute lock is far too short for a single job.
const PULSE_LOCK_DURATION = 1800000;

let worker: Worker | null = null;
let shutdownInProgress = false;

// Fixed locale so a count reads the same wherever the worker runs.
function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

async function setProgress(jobId: string, progress: string): Promise<void> {
  await storage.hset(`pulse-job:${jobId}`, {
    status: 'processing',
    progress,
    last_updated: Date.now(),
  });
}

/**
 * Moves a job to its terminal failed state in both places the status is read
 * from. Without this the page polls a job that will never finish.
 */
async function markJobFailed(jobId: string, message: string): Promise<void> {
  await updatePulseJobStatus(jobId, 'error', message);
  await storage.hset(`pulse-job:${jobId}`, {
    status: 'error',
    error: message,
    last_updated: Date.now(),
  });
}

/**
 * A message that already carries a fix was written for the user and is kept verbatim.
 * Anything else is internal text — the raw exception is logged, never shown.
 */
function toStoredErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (parsePulseErrorMessage(message).fix !== null) {
    return message;
  }

  return formatPulseError(stoppedUnexpectedlyError());
}

/**
 * A completed run still has results worth reading, but must not read as clean when responses,
 * results files, or the written summary were lost. Every loss merges into one cause and one fix,
 * and each names only what the user can actually act on.
 */
function completionWarning(
  failedRowCount: number,
  rowCount: number,
  errors: PulseOutputErrors,
): string | null {
  const causes: string[] = [];
  const fixes: string[] = [];

  if (failedRowCount > 0) {
    causes.push(`${formatCount(failedRowCount)} of ${formatCount(rowCount)} responses couldn't be analyzed and were filled with their fallback values.`);
    fixes.push('Check the model is available, then run the survey again for a complete set.');
  }

  if (PULSE_OUTPUT_FILE_KINDS.some((kind) => errors[kind] !== undefined)) {
    causes.push('The analysis finished but some results files couldn\'t be made.');
    fixes.push('Open the Results tab for details, then run the survey again.');
  }

  if (errors.narrative !== undefined) {
    causes.push('The written summary couldn\'t be written, so the numbers come with nothing explaining them.');
    fixes.push('Run the survey again to try the summary once more.');
  }

  if (causes.length === 0) {
    return null;
  }

  return formatPulseError({ cause: causes.join(' '), fix: fixes.join(' ') });
}

// A row whose extraction failed outright is recorded the same way a single failed
// cell is, so the results show a fallback rather than a missing respondent.
function defaultedRowValues(fields: PulseFieldConfig[], reason: string): PulseExtractedValue[] {
  return fields.map((field) => ({
    fieldName: field.fieldName,
    value: field.defaultValue ?? '',
    wasDefaulted: true,
    failureReason: reason,
  }));
}

type DeriveRowParams = {
  jobId: string;
  row: ParsedSurveyRow;
  fields: PulseFieldConfig[];
  persona: string;
  modelName: string;
  completionAdapter: AiFactoryCompletionAdapter;
};

async function deriveRowValues(params: DeriveRowParams): Promise<PulseExtractedValue[]> {
  const { jobId, ...extractParams } = params;

  try {
    return await extractRowValues(extractParams);
  } catch (error) {
    logger.error('PULSE row extraction failed', {
      jobId,
      rowNumber: params.row.rowNumber,
      error: (error as Error).message,
    });

    return defaultedRowValues(params.fields, 'The response could not be analyzed');
  }
}

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;
  logger.info(`${signal} received, shutting down PULSE worker...`);

  try {
    await storage.del('worker:pulse:running');

    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down PULSE worker after timeout');
        throw new Error('Force PULSE worker shutdown due to timeout');
      }, WORKER_SHUTDOWN_TIMEOUT);
      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('PULSE worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down PULSE worker:', error);
    throw error;
  }
};

export const startPulseWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch {
    logger.info('Redis not available — skipping PULSE queue/worker startup.');
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping PULSE worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('PULSE worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<PulseJobData>(
    PULSE_QUEUE_NAME,
    async (job) => {
      const { jobId, userId, userGroupId, modelId, surveyFileKey, documentUploadProviderId } = job.data;

      logger.info('PULSE job started', { jobId, attempt: job.attemptsMade + 1 });

      let storageProvider: StorageProvider | null = null;

      try {
        await updatePulseJobStatus(jobId, 'processing');

        const record = await getPulseJob(jobId, userId, null);

        if (!record) {
          throw new Error('PULSE job configuration was not found');
        }

        const { config } = record;

        // Read before the download so the file phase can report the scale the user
        // previewed, rather than going quiet until the parse produces a real count.
        await setProgress(
          jobId,
          `Reading ${formatCount(record.responseCount)} responses from the survey file...`,
        );

        try {
          ({ source: storageProvider } = await new DocumentUploadFactory({ userId })
            .buildSource(documentUploadProviderId));
        } catch (error) {
          logger.error('PULSE storage provider could not be built', {
            jobId,
            error: (error as Error).message,
          });
          const { cause, fix } = storageUnavailableError();
          throw new PulseUserError(cause, fix);
        }

        const completionSource = await new AIFactory({ userId, userGroupId: userGroupId ?? undefined })
          .buildUserSource(modelId);
        const completionAdapter = new AiFactoryCompletionAdapter(completionSource);

        const buffer = await storageProvider.fetchFile(surveyFileKey);
        const { rows, surveyColumns } = await parseSurveySpreadsheet(buffer, config);

        // The client set this from its own preview parse; the worker's parse is
        // the authoritative one, so correct it before progress is reported against it.
        await updatePulseJobResponseCount(jobId, rows.length);

        // Resume rather than restart: a retried attempt must not re-bill rows
        // whose values are already saved.
        const processed = new Set(await getProcessedRowNumbers(jobId));
        const pending = rows.filter((row) => !processed.has(row.rowNumber));

        // Rows are saved in the order the file listed them, which a resumed run only
        // knows from the whole file rather than from the rows left to do.
        const fileOrder = new Map(rows.map((row, index) => [row.rowNumber, index]));

        logger.info('PULSE rows to process', {
          jobId,
          total: rows.length,
          alreadyProcessed: processed.size,
        });

        for (const [index, row] of pending.entries()) {
          await setProgress(
            jobId,
            `Analyzing ${formatCount(processed.size + index + 1)} of ${formatCount(rows.length)} responses`,
          );

          const values = await deriveRowValues({
            jobId,
            row,
            fields: config.fields,
            persona: config.persona,
            modelName: completionSource.model.name,
            completionAdapter,
          });

          await savePulseResult({
            jobId,
            rowNumber: row.rowNumber,
            responseText: row.responseText,
            cells: toResultCells(row.cells),
            sortOrder: fileOrder.get(row.rowNumber) ?? 0,
            values,
          });
        }

        // Counted from the saved rows so a retried job still reports responses lost earlier.
        const failedRowCount = await countFullyDefaultedRows(jobId);

        await setProgress(jobId, 'Profiling columns…');

        // Every saved row, not just this attempt's, so a resumed run profiles the whole file.
        const { results } = await getPulseResults(jobId, userId, null);
        const completedAt = new Date();

        const outputs = await generateResultsOutputs({
          jobId,
          userId,
          facts: {
            surveyFilename: record.surveyFilename,
            modelName: record.modelName ?? completionSource.model.name,
            completedAt,
            rowsInFile: rows.length,
            rowsAnalyzed: rows.length - failedRowCount,
            failedRowCount,
          },
          rows,
          surveyColumns,
          toolColumns: buildToolColumns(config.fields, rows, results),
          persona: config.persona,
          resultsFocus: config.resultsFocus,
          completionAdapter,
          onProgress: (progress) => setProgress(jobId, progress),
        });

        await updatePulseJobOutputs(jobId, {
          outputs,
          failedRowCount,
          completedAt,
        });

        const warning = completionWarning(failedRowCount, rows.length, outputs.errors);

        await updatePulseJobStatus(jobId, 'completed', warning);

        await storage.hset(`pulse-job:${jobId}`, {
          status: 'completed',
          progress: `Analyzed ${rows.length} responses`,
          last_updated: Date.now(),
          completed: Date.now(),
          ...(warning ? { error: warning } : {}),
        });

        await storageProvider.deleteFile(surveyFileKey);

        logger.info('PULSE job completed', {
          jobId,
          responseCount: rows.length,
          failedRowCount,
          outputErrors: Object.keys(outputs.errors),
        });
      } catch (error) {
        logger.error('PULSE job failed', {
          jobId,
          attempt: job.attemptsMade + 1,
          error: (error as Error).message,
        });

        // Only mark the job failed once BullMQ has exhausted its attempts; an
        // earlier attempt's failure is followed by a resume, not a dead job.
        if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
          await markJobFailed(jobId, toStoredErrorMessage(error));
          await storageProvider?.deleteFile(surveyFileKey).catch(() => undefined);
        }

        throw error;
      }
    },
    {
      connection,
      ...DEFAULT_WORKER_CONFIG,
      lockDuration: PULSE_LOCK_DURATION,
      concurrency: 1,
    },
  );

  worker.on('failed', async (job, error) => {
    logger.error('PULSE worker job failed', { jobId: job?.data.jobId, error: error.message });
    reportJobFailure(job, error);

    // A stalled-out or killed attempt never reaches the processor, so this is the
    // only place left to move the job off `processing`. `finishedOn` is set only
    // once BullMQ is done retrying, so this never pre-empts a resume.
    if (!job?.data.jobId || !job.finishedOn) {
      return;
    }

    try {
      const record = await getPulseJobStatus(job.data.jobId, job.data.userId, null);

      if (record && record.status !== 'completed' && record.status !== 'error') {
        await markJobFailed(job.data.jobId, formatPulseError(stoppedUnexpectedlyError()));
      }
    } catch (markError) {
      logger.error('PULSE job could not be marked failed', {
        jobId: job.data.jobId,
        error: (markError as Error).message,
      });
    }
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('PULSE worker started');

  await worker.run();
};
