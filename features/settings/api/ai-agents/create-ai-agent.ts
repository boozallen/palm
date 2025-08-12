import { trpc } from '@/libs';

export default function useCreateAiAgent() {
  const utils = trpc.useUtils();

  return trpc.settings.createAiAgent.useMutation({
    onSuccess: (data) => {
      utils.settings.getAiAgents.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          aiAgents: [
            ...oldData.aiAgents,
            {
              id: data.id,
              name: data.name,
              description: data.description,
              type: data.type,
            },
          ],
        };
      });

      utils.settings.getAiAgent.setData({ id: data.id }, () => {
        return {
          id: data.id,
          name: data.name,
          description: data.description,
          type: data.type,
        };
      });
    },
  });
}
