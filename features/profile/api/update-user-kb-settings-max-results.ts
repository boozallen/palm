import { trpc } from '@/libs';

export default function useUpdateUserKbSettingsMaxResults() {
  const utils = trpc.useUtils();

  return trpc.profile.updateUserKbSettingsMaxResults.useMutation({
    onSuccess: (data) => {
      utils.shared.getUserAdvancedKbSettings.setData(
        undefined,
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return { 
            knowledgeBasesMinScore: oldData.knowledgeBasesMinScore,
            knowledgeBasesMaxResults: data.knowledgeBasesMaxResults,
          };
        }
      );
    },
  });
}
