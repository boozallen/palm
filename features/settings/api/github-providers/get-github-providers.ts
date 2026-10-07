import { trpc } from '@/libs';

export default function useGetGitHubProviders() {
  return trpc.settings.getGitHubProviders.useQuery();
}
