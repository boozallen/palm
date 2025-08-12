import { trpc } from '@/libs';

// Get all available agents for a user.
export default function useGetAvailableAgents() {
  return trpc.shared.getAvailableAgents.useQuery();
}
