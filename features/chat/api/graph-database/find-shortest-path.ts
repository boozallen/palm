import { trpc } from '@/libs';

interface FindShortestPathParams {
  documentIds: string[];
  nodeNeoIds: number[];
}

export default function useFindShortestPath() {
  const utils = trpc.useUtils();

  return {
    fetch: async (params: FindShortestPathParams) => {
      return utils.chat.graphDatabase.findShortestPath.fetch(params);
    },
  };
}
