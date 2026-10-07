import db from '@/server/db';
import logger from '@/server/logger';
import type { PulseFieldConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';

type CreatePulseJobParams = {
  id: string;
  aiAgentId: string;
  userId: string;
  userGroupId: string | null;
  surveyFilename: string;
  responseCount: number;
  persona: string;
  resultsFocus: string | null;
  modelId: string;
  modelName: string | null;
  sheetName: string;
  headerRow: number;
  inputColumns: string[];
  fields: PulseFieldConfig[];
};

/**
 * Creates the job and its field matrix in a single nested write, so a job can
 * never exist without the configuration the worker needs to run it.
 */
export default async function createPulseJob(
  params: CreatePulseJobParams,
): Promise<{ id: string }> {
  try {
    return await db.agentPulseJob.create({
      data: {
        id: params.id,
        aiAgentId: params.aiAgentId,
        userId: params.userId,
        userGroupId: params.userGroupId,
        surveyFilename: params.surveyFilename,
        responseCount: params.responseCount,
        status: 'queued',
        persona: params.persona,
        resultsFocus: params.resultsFocus,
        modelId: params.modelId,
        modelName: params.modelName,
        sheetName: params.sheetName,
        headerRow: params.headerRow,
        inputColumns: params.inputColumns,
        fields: {
          create: params.fields.map((field) => ({
            fieldName: field.fieldName,
            prompt: field.prompt,
            fieldType: field.fieldType,
            allowedValues: field.allowedValues,
            defaultValue: field.defaultValue,
            inputColumnRefs: field.inputColumnRefs,
            sortOrder: field.sortOrder,
          })),
        },
      },
      select: { id: true },
    });
  } catch (error) {
    logger.error('Failed to create PULSE job', {
      jobId: params.id,
      error: (error as Error).message,
    });
    throw new Error('Failed to create PULSE job');
  }
}
