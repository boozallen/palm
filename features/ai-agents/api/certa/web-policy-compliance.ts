import { trpc } from '@/libs';

export const useWebPolicyCompliance = () => {
  return trpc.aiAgents.webPolicyCompliance.useMutation();
};

export const useComplianceStatus = (jobId: string | null) => {
  return trpc.aiAgents.getComplianceStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: false,
    }
  );
};
