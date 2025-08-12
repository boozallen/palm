import { Queue } from 'bullmq';

import { getRedisClient } from '@/server/storage/redisConnection';

export type ResearchJobData = {
  agentId: string;
  jobId: string;
  userId: string;
  dateStart: string;
  dateEnd: string;
  model: string;
  categories: string[];
  institutions: string[];
  searchHash: string;
};

let researchQueue: Queue<ResearchJobData> | null = null;

export const getResearchQueue = (): Queue<ResearchJobData> | null => {
  if (researchQueue) {
    return researchQueue;
  }

  try {
    const connection = getRedisClient();
    researchQueue = new Queue<ResearchJobData>('research-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      },
    });
    return researchQueue;
  } catch {
    return null;
  }
};
