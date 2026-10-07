import { trpc } from '@/libs';

export default function useGetGitHubProvider(id: string) {
  return trpc.settings.getGitHubProvider.useQuery({ id });
}
