import { trpc } from '@/libs';

export const useGetMarginAnalysis = (
  aiAgentId: string,
  analysisId: string | null,
) => {
  return trpc.aiAgents.getMarginAnalysis.useQuery(
    { aiAgentId, analysisId: analysisId ?? '' },
    { enabled: !!analysisId },
  );
};
