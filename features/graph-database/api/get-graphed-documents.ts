import { trpc } from '@/libs/trpc';

/**
 * Hook to get the list of document IDs that have been graphed for the current user.
 */
export const useGetGraphedDocuments = () => {
  return trpc.graph.getGraphedDocuments.useQuery();
};
