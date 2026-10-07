import { trpc } from '@/libs';

export default function usePrismJobs(agentId: string) {
  return trpc.aiAgents.getPrismJobs.useQuery({ agentId });
}
