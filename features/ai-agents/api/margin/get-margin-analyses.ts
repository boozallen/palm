import { trpc } from '@/libs';

export const useGetMarginAnalyses = (aiAgentId: string) => {
  return trpc.aiAgents.getMarginAnalyses.useQuery({ aiAgentId });
};
