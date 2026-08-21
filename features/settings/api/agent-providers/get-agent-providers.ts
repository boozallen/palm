import { trpc } from '@/libs';

export default function useGetAgentProviders() {
  return trpc.settings.getAgentProviders.useQuery();
}
