import { trpc } from '@/libs';

export default function useUpdateUserKbSettingsMinScore() {
  const utils = trpc.useUtils();

  return trpc.profile.updateUserKbSettingsMinScore.useMutation({
    onSuccess: (data) => {
      utils.shared.getUserAdvancedKbSettings.setData(
        undefined,
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { 
            knowledgeBasesMinScore: data.knowledgeBasesMinScore,
            knowledgeBasesMaxResults: oldData.knowledgeBasesMaxResults,
          };
        }
      );
    },
  });
}
