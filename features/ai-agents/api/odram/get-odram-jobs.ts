import { trpc } from '@/libs';

export default function useOdramJobs(agentId: string) {
  return trpc.aiAgents.getOdramJobs.useQuery({ agentId });
}
