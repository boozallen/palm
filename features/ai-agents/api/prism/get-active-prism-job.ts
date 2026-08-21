import { trpc } from '@/libs';

export default function useActivePrismJob(agentId: string) {
  return trpc.aiAgents.getActivePrismJob.useQuery({ agentId });
}
