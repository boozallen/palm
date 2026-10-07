import { trpc } from '@/libs';

export default function useRefreshSkillRepo() {
  const utils = trpc.useContext();

  return trpc.settings.refreshSkillRepo.useMutation({
    onSuccess: () => {
      utils.settings.getGitHubProviders.invalidate();
    },
  });
}
