import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import React from 'react';
import { getFetch, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { ServerRouter } from '@/server/router';

const createWrapper = () => {
  const trpc = createTRPCReact<ServerRouter>();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        fetch: async (input, init?) => {
          const fetch = getFetch();
          return fetch(input, {
            ...init,
          });
        },
      }),
    ],
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );

  return Wrapper;
};
export const renderWrapper = (ui: React.ReactElement) => {
  return render(ui, { wrapper: createWrapper() });
};

// export const testTRPC = createTRPCMsw<ServerRouter>();
