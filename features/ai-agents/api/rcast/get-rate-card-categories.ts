import { trpc } from '@/libs';

export const useGetRateCardCategories = (aiAgentId: string, rateCardId: string | null) => {
  return trpc.aiAgents.getRateCardCategories.useQuery(
    { aiAgentId, rateCardId: rateCardId! },
    {
      enabled: !!rateCardId,
    }
  );
};
