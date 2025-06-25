import { ServerRouter } from '@/server/router';
import { createTRPCNext } from '@trpc/next';
import { httpBatchLink } from '@trpc/client';
import { defaultOptions } from '@/libs/react-query';

export const trpc = createTRPCNext<ServerRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
      queryClientConfig: {
        defaultOptions,
      },
    };
  },
  ssr: false,
});
