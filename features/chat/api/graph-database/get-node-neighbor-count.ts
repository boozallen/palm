import { trpc } from '@/libs';

interface NodeNeighborCountParams {
  documentIds: string[];
  nodeNeoId: number;
}

export default function useNodeNeighborCount() {
  const utils = trpc.useUtils();

  return {
    fetch: async (params: NodeNeighborCountParams) => {
      return utils.chat.graphDatabase.getNodeNeighborCount.fetch(params);
    },
  };
}
