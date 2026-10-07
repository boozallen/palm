import db from '@/server/db';
import logger from '@/server/logger';
import toFieldConfig from '@/features/ai-agents/dal/pulse/toFieldConfig';
import type { PulseJobConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type {
  PulseNarrative,
  PulseOutputErrors,
  PulseResultsProfile,
} from '@/features/ai-agents/types/pulse/results';

export type PulseJobRecord = {
  id: string;
  status: string;
  errorMessage: string | null;
  surveyFilename: string;
  responseCount: number;
  modelId: string | null;
  modelName: string | null;
  failedRowCount: number | null;
  completedAt: Date | null;
  resultsProfile: PulseResultsProfile | null;
  resultsNarrative: PulseNarrative | null;
  outputErrors: PulseOutputErrors | null;
  createdAt: Date;
  config: PulseJobConfig;
};

// A null agentId reads the job whichever agent owns it, for the worker running its own queued job.
export default async function getPulseJob(
  jobId: string,
  userId: string,
  agentId: string | null,
): Promise<PulseJobRecord | null> {
  try {
    const job = await db.agentPulseJob.findFirst({
      where: { id: jobId, userId, ...(agentId === null ? {} : { aiAgentId: agentId }) },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        surveyFilename: true,
        responseCount: true,
        modelId: true,
        modelName: true,
        failedRowCount: true,
        completedAt: true,
        resultsProfile: true,
        resultsNarrative: true,
        outputErrors: true,
        createdAt: true,
        persona: true,
        resultsFocus: true,
        sheetName: true,
        headerRow: true,
        inputColumns: true,
        fields: {
          orderBy: { sortOrder: 'asc' },
          select: {
            fieldName: true,
            prompt: true,
            fieldType: true,
            allowedValues: true,
            defaultValue: true,
            inputColumnRefs: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      status: job.status,
      errorMessage: job.errorMessage,
      surveyFilename: job.surveyFilename,
      responseCount: job.responseCount,
      modelId: job.modelId,
      modelName: job.modelName,
      failedRowCount: job.failedRowCount,
      completedAt: job.completedAt,
      // Json columns: written only by updatePulseJobOutputs in these shapes.
      resultsProfile: job.resultsProfile as unknown as PulseResultsProfile | null,
      resultsNarrative: job.resultsNarrative as unknown as PulseNarrative | null,
      outputErrors: job.outputErrors as unknown as PulseOutputErrors | null,
      createdAt: job.createdAt,
      config: {
        persona: job.persona,
        resultsFocus: job.resultsFocus,
        sheetName: job.sheetName,
        headerRow: job.headerRow,
        inputColumns: job.inputColumns,
        fields: job.fields.map(toFieldConfig),
      },
    };
  } catch (error) {
    logger.error('Failed to load PULSE job', { jobId, error: (error as Error).message });
    throw new Error('Failed to load PULSE job');
  }
}
