import { trpc } from '@/libs';

export default function useGetAvailableGitHubProviders() {
  return trpc.shared.getAvailableGitHubProviders.useQuery();
}
