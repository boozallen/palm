import { trpc } from '@/libs';

export default function useUpdateUserPreselectedKnowledgeBases() {
  const utils = trpc.useContext();

  return trpc.profile.updateUserPreselectedKnowledgeBases.useMutation({
    onSuccess: (data) => {
      utils.shared.getUserPreselectedKnowledgeBases.setData(
        undefined,
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { userPreselectedKnowledgeBases: data.knowledgeBases };
        }
      );
    },
  });
}
