import { ServerRouter } from '@/server/router';
import { createTRPCNext } from '@trpc/next';
import { httpBatchLink, httpLink, splitLink } from '@trpc/client';
import { defaultOptions } from '@/libs/react-query';

export const trpc = createTRPCNext<ServerRouter>({
  config() {
    return {
      links: [
        splitLink({
          condition(op) {
            /* Check if the current api path is the uploadDocument route */
            return Boolean(op.path === 'shared.uploadDocument');
          },
          /* If it is, then direct to /api/pdl which allows for larger body size limit */
          true: httpLink({
            url: '/api/upload-document',
          }),
          /* If not, fall back to usual /api/trpc URL */
          false: httpBatchLink({
            url: '/api/trpc',
          }),
        }),
      ],
      queryClientConfig: {
        defaultOptions,
      },
    };
  },
  ssr: false,
});
