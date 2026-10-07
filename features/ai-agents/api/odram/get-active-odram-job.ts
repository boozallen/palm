import { trpc } from '@/libs';

export default function useActiveOdramJob(agentId: string) {
  return trpc.aiAgents.getActiveOdramJob.useQuery({ agentId });
}
