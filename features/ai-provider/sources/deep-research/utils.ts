import logger from '@/server/logger';

/**
 * Logs the successful start of a deep research job.
 */
export const logDeepResearchJobStarted = (providerName: string, jobId: string): void => {
  logger.debug(`${providerName} deep research job started: ${jobId}`);
};

/**
 * Logs a deep research error with standardized format.
 */
export const logDeepResearchError = (
  providerName: string,
  error: unknown
): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`${providerName} deep research failed:`, {
    error: errorMessage,
    stack: error instanceof Error ? error.stack : '',
  });
};

/**
 * Logs the completion of a deep research job.
 */
export const logDeepResearchCompleted = (providerName: string, jobId: string): void => {
  logger.debug(`${providerName} deep research job ${jobId} completed`);
};

/**
 * Logs deep research polling status.
 */
export const logDeepResearchPolling = (
  providerName: string,
  jobId: string,
  error: unknown
): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Failed to poll ${providerName} deep research status:`, {
    jobId,
    error: errorMessage,
  });
};
