import { trpc } from '@/libs';

export default function usePulseJobs(agentId: string) {
  return trpc.aiAgents.getPulseJobs.useQuery({ agentId });
}
