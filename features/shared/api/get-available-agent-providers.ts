import { trpc } from '@/libs';

export default function useGetAvailableAgentProviders() {
  return trpc.shared.getAvailableAgentProviders.useQuery();
}
