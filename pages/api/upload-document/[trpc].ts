import { createNextApiHandler } from '@trpc/server/adapters/next';

import { serverRouter } from '@/server/router';
import { createContext } from '@/server/trpc-context';
import logger from '@/server/logger';
import { startDocumentWorker } from '@/features/document-upload-provider/workers/documentWorker';

startDocumentWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start document worker:', err);
  }
});

// Configure Next.js body parser to allow larger uploads for document upload routes
// Note: Must be a static value, not a template literal
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '7mb', // Accommodates 5MB files + base64 encoding overhead
    },
  },
};

export default createNextApiHandler({
  router: serverRouter,
  createContext,
});
