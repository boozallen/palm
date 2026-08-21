import { trpc } from '@/libs';

export default function useDeleteAgentProvider() {
  const utils = trpc.useContext();

  return trpc.settings.deleteAgentProvider.useMutation({
    onSuccess: () => {
      utils.settings.getAgentProviders.invalidate();
      utils.shared.getAvailableAgentProviders.invalidate();
    },
  });
}
