import { trpc } from '@/libs';

export const useStartResearchJob = () => {
  return trpc.aiAgents.startResearchJob.useMutation();
};
