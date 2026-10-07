import { trpc } from '@/libs';

export default function useDeleteKbProvider() {
  const utils = trpc.useContext();

  return trpc.settings.deleteKbProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getKbProviders.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = oldData.kbProviders.filter(
          (provider) => provider.id !== data.id
        );

        return {
          kbProviders: newData,
        };
      });

      utils.settings.getKnowledgeBases.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          knowledgeBases: oldData.knowledgeBases.filter(
            (knowledgeBase) => knowledgeBase.kbProviderId !== data.id
          ),
        };

        return newData;
      });

      utils.settings.getUserGroupKbProviders.invalidate();
    },
  });
}
