import { trpc } from '@/libs';

export default function useCreateKnowledgeBase() {
  const utils = trpc.useContext();

  return trpc.settings.createKnowledgeBase.useMutation({
    onSuccess: (data) => {
      utils.settings.getKnowledgeBases.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return { knowledgeBases: [...oldData.knowledgeBases, data] };
      });

      utils.shared.getUserKnowledgeBases.invalidate();
    },
  });
}
