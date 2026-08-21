import { trpc } from '@/libs';

export default function useUpdateAgentProvider() {
  const utils = trpc.useContext();

  return trpc.settings.updateAgentProvider.useMutation({
    onSuccess: () => {
      utils.settings.getAgentProviders.invalidate();
      utils.shared.getAvailableAgentProviders.invalidate();
    },
  });
}
