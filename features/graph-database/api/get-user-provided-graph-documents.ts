import { trpc } from '@/libs/trpc';

/**
 * Hook returning the IDs of documents that will be ingested as a native
 * palm-graph (user-provided) rather than run through LLM extraction.
 */
export const useGetUserProvidedGraphDocuments = () => {
  return trpc.graph.getUserProvidedGraphDocuments.useQuery();
};
