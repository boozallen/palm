import { createNextApiHandler } from '@trpc/server/adapters/next';

import { serverRouter } from '@/server/router';
import { createContext } from '@/server/trpc-context';
import logger from '@/server/logger';
import { startResearchWorker } from '@/features/ai-agents/utils/radar/researchWorker';

startResearchWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start research worker:', err);
  }
});

export default createNextApiHandler({
  router: serverRouter,
  createContext,
});
