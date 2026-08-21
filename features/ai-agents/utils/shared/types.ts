/**
 * Shared types and constants for AI Agent workers and queues
 */

export interface BaseJobData {
  jobId: string;
  userId: string;
  agentId: string;
}

export type JobStatusType = 'queued' | 'processing' | 'completed' | 'error';

export interface JobStatus {
  status: JobStatusType;
  progress?: string;
  results?: string;
  error?: string;
  last_updated: number;
  completed?: number;
}

export interface WorkerConfig {
  lockDuration: number;
  concurrency: number;
  limiter: {
    max: number;
    duration: number;
  };
  stalledInterval: number;
  maxStalledCount: number;
}

/**
 * Default worker configuration used across all agents
 * Can be overridden per agent based on specific needs
 */
export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  lockDuration: 300000, // 5 minutes
  concurrency: 5,
  limiter: {
    max: 5,
    duration: 5000,
  },
  stalledInterval: 180000, // 3 minutes
  maxStalledCount: 2,
};

/**
 * Default queue options used across all agents
 */
export const DEFAULT_QUEUE_OPTIONS = {
  removeOnComplete: 10,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 30000,
  },
};

/**
 * Standard shutdown timeout for all workers
 */
export const WORKER_SHUTDOWN_TIMEOUT = 15000; // 15 seconds
