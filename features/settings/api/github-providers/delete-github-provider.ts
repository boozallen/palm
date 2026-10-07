import { trpc } from '@/libs';

export default function useDeleteGitHubProvider() {
  const utils = trpc.useContext();

  return trpc.settings.deleteGitHubProvider.useMutation({
    onSuccess: () => {
      utils.settings.getGitHubProviders.invalidate();
    },
  });
}
