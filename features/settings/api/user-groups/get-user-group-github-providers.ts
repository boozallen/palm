import { trpc } from '@/libs';

export default function useGetUserGroupGitHubProviders(id: string) {
  return trpc.settings.getUserGroupGitHubProviders.useQuery({ id });
}
