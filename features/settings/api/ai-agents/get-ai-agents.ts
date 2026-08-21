import { trpc } from '@/libs';

// Get all AI Agents
export default function useGetAiAgents() {
  return trpc.settings.getAiAgents.useQuery();
}
