import { trpc } from '@/libs';

export default function useAddGitHubProvider() {
  const utils = trpc.useContext();

  return trpc.settings.addGitHubProvider.useMutation({
    onSuccess: () => {
      utils.settings.getGitHubProviders.invalidate();
    },
  });
}
