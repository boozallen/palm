import { trpc } from '@/libs';

export default function useGetSharedDocuments() {
  return trpc.shared.getSharedDocuments.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        return false;
      }

      // Check if there are any pending incoming documents (requiring user action)
      const hasPendingSharedDocuments = data.incoming && data.incoming.length > 0;

      // Poll every 3 seconds if there are pending incoming shares, otherwise stop polling
      return hasPendingSharedDocuments ? 3000 : false;
    },
    refetchOnWindowFocus: true, // Refetch when user returns to window
  });
}
