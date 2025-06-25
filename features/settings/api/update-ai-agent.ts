import { trpc } from '@/libs';

export default function useUpdateAiAgent() {
  const utils = trpc.useUtils();

  return trpc.settings.updateAiAgent.useMutation({
    onSuccess: (data) => {
      utils.settings.getAiAgents.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          aiAgents: oldData.aiAgents.map((agent) =>
            agent.id === data.aiAgent.id ? data.aiAgent : agent
          ),
        };
      });
      utils.shared.getUserEnabledAiAgents.invalidate();
    },
  });
}
