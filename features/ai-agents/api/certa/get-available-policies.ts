import { trpc } from '@/libs';

export default function useGetAvailablePolicies(agentId: string, search?: string, limit: number = 10) {
  return trpc.aiAgents.getAvailablePolicies.useQuery({ agentId, search, limit });
}
