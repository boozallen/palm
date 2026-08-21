import { trpc } from '@/libs';

export default function useDeleteAiAgent() {
  const utils = trpc.useUtils();

  return trpc.settings.deleteAiAgent.useMutation({
    onSuccess: (data) => {
      // Set the agent cache to undefined
      utils.settings.getAiAgent.setData({ id: data.id }, undefined);

      // Remove deleted agent from the list of agents
      utils.settings.getAiAgents.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = oldData.aiAgents.filter(
          (agent) => agent.id !== data.id
        );

        return {
          aiAgents: newData,
        };
      });

      utils.shared.getAvailableAgents.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = oldData.availableAgents.filter(
          (agent) => agent.id !== data.id
        );

        return {
          availableAgents: newData,
        };
      });
    },
  });
}
