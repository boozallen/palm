import { trpc } from '@/libs';

export const useWebPolicyCompliance = () => {
  return trpc.aiAgents.webPolicyCompliance.useMutation();
};

export const useComplianceStatus = (agentId: string, jobId: string | null) => {
  return trpc.aiAgents.getComplianceStatus.useQuery(
    { agentId, jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: false,
    }
  );
};
