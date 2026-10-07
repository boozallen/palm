/**
 * Shared types and constants for AI Agent workers and queues
 */

export interface BaseJobData {
  jobId: string;
  userId: string;
  agentId: string;
  // Which user group the run this job belongs to should be attributed to.
  // Carried on the job payload since the worker that ultimately calls AIFactory
  // runs on a separate pass than the request that enqueued the job.
  userGroupId?: string | null;
}

// Listed as a value so route schemas can validate against the same set the type allows.
export const JOB_STATUSES = ['queued', 'processing', 'completed', 'error'] as const;

export type JobStatusType = typeof JOB_STATUSES[number];

// The status column is free text, so a value read back is only a job status once checked.
export function isJobStatus(status: string): status is JobStatusType {
  return (JOB_STATUSES as readonly string[]).includes(status);
}

// A run still owns the agent: queued or already being worked.
export const ACTIVE_JOB_STATUSES = ['queued', 'processing'] as const;

export type ActiveJobStatus = typeof ACTIVE_JOB_STATUSES[number];

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
