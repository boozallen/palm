import { trpc } from '@/libs';

export default function useDeleteKnowledgeBase() {
  const utils = trpc.useContext();

  return trpc.settings.deleteKnowledgeBase.useMutation({
    onSuccess: async (data) => {
      utils.settings.getKnowledgeBases.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          knowledgeBases: oldData.knowledgeBases.filter(
            (knowledgeBase) => knowledgeBase.id !== data.id
          ),
        };
      });

      utils.shared.getUserKnowledgeBases.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          userKnowledgeBases: oldData.userKnowledgeBases.filter(
            (knowledgeBase) => knowledgeBase.id !== data.id
          ),
        };
      });

      utils.shared.getUserPreselectedKnowledgeBases.setData(
        undefined,
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            userPreselectedKnowledgeBases:
              oldData.userPreselectedKnowledgeBases.filter(
                (knowledgeBase) => knowledgeBase.id !== data.id
              ),
          };
        }
      );
    },
  });
}
