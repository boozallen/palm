import { trpc } from '@/libs';

export default function useUpdateAiAgent() {
  const utils = trpc.useUtils();

  return trpc.settings.updateAiAgent.useMutation({
    onSuccess: (data) => {
      // Update the list of agents
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

      // Update the individual agent cache
      utils.settings.getAiAgent.setData({ id: data.aiAgent.id }, () => {
        return data.aiAgent;
      });

      // Invalidate the available agents cache
      utils.shared.getAvailableAgents.invalidate();
    },
  });
}
