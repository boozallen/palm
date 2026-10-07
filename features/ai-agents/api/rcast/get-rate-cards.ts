import { trpc } from '@/libs';

export const useGetRateCards = (aiAgentId: string) => {
  return trpc.aiAgents.getRateCards.useQuery({ aiAgentId });
};
