import { trpc } from '@/libs';

export default function useUpdateKnowledgeBase() {
  const utils = trpc.useContext();

  return trpc.settings.updateKnowledgeBase.useMutation({
    onSuccess: (data) => {
      utils.settings.getKnowledgeBases.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const index = oldData.knowledgeBases.findIndex(
          (knowledgeBase) => knowledgeBase.id === data.id
        );
        const newData = { knowledgeBases: [...oldData.knowledgeBases] };
        newData.knowledgeBases[index] = data;

        return newData;
      });

      utils.shared.getUserKnowledgeBases.invalidate();
    },
  });
}
