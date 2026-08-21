import { trpc } from '@/libs';

export default function useGetDocumentUploadRequirements() {
  // Refetched on mount rather than served from cache: an admin can add or delete
  // the embedding model at any time, and a stale `configured: true` leaves the
  // upload entry points enabled for an upload the server will reject.
  return trpc.shared.getDocumentUploadRequirements.useQuery(undefined, {
    refetchOnMount: 'always',
  });
}
