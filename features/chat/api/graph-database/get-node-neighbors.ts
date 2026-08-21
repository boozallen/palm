import { trpc } from '@/libs';

interface NodeNeighborsParams {
  documentIds: string[];
  nodeNeoId: number;
}

export default function useNodeNeighbors() {
  const utils = trpc.useUtils();

  return {
    fetch: async (params: NodeNeighborsParams) => {
      return utils.chat.graphDatabase.getNodeNeighbors.fetch(params);
    },
  };
}
