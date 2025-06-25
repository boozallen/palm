import { createNextApiHandler } from '@trpc/server/adapters/next';
import { serverRouter } from '@/server/router';
import { createContext } from '@/server/trpc-context';

export default createNextApiHandler({
  router: serverRouter,
  createContext,
});
