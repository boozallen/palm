import { trpc } from '@/libs';

export default function useUpdateGitHubProvider() {
  const utils = trpc.useContext();

  return trpc.settings.updateGitHubProvider.useMutation({
    onSuccess: () => {
      utils.settings.getGitHubProviders.invalidate();
    },
  });
}
