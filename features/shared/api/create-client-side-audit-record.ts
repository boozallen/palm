import { trpc } from '@/libs';

// Capture the page the user is currently on at click time. The server-side
// Referer header is unreliable here: the accompanying navigation (router.push)
// changes the URL before the request is sent, so the header reports the
// destination rather than the source page.
export function useCreateClientSideAuditRecord() {
  const mutation = trpc.shared.createClientSideAuditRecord.useMutation();

  return {
    ...mutation,
    mutate: (input: Omit<Parameters<typeof mutation.mutate>[0], 'referer'>) =>
      mutation.mutate({
        ...input,
        referer: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
  };
}
