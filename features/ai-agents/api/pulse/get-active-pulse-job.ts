import { trpc } from '@/libs';

export default function useActivePulseJob(agentId: string) {
  return trpc.aiAgents.getActivePulseJob.useQuery({ agentId });
}
