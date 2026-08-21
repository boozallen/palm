import { trpc } from '@/libs';

interface EdgesBetweenParams {
  documentIds: string[];
  newNodeNeoIds: number[];
  existingNodeNeoIds: number[];
}

export default function useEdgesBetween() {
  const utils = trpc.useUtils();

  return {
    fetch: async (params: EdgesBetweenParams) => {
      return utils.chat.graphDatabase.getEdgesBetween.fetch(params);
    },
  };
}
