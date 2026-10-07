import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import logger from '@/server/logger';
import {
  BaseJobData,
  DEFAULT_QUEUE_OPTIONS,
} from '@/features/ai-agents/utils/shared/types';

export type OdramDocumentMapping = Record<number, string[]>;
export type OdramQuestionContext = Record<number, string>;

export interface OdramProposalFile {
  fileKey: string;
  fileName: string;
  contentType: string;
}

export interface OdramJobData extends BaseJobData {
  odramFileKey: string;
  odramFileName: string;
  odramContentType: string;
  promptMatrixFileKey: string;
  promptMatrixFileName: string;
  promptMatrixContentType: string;
  proposalFiles: OdramProposalFile[];
  documentUploadProviderId: string;
  modelId: string;
  documentMapping: OdramDocumentMapping | null;
  questionContext: OdramQuestionContext | null;
}

let queue: Queue<OdramJobData> | null = null;

export const getOdramQueue = (): Queue<OdramJobData> | null => {
  if (queue) {
    return queue;
  }

  try {
    const connection = getRedisClient();
    queue = new Queue<OdramJobData>('odram-jobs', {
      connection,
      defaultJobOptions: DEFAULT_QUEUE_OPTIONS,
    });
    return queue;
  } catch (error) {
    logger.info('Redis not available — ODRAM queue not initialized.');
    return null;
  }
};
