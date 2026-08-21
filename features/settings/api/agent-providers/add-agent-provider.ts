import { trpc } from '@/libs';

export default function useAddAgentProvider() {
  const utils = trpc.useContext();

  return trpc.settings.addAgentProvider.useMutation({
    onSuccess: () => {
      utils.settings.getAgentProviders.invalidate();
    },
  });
}
