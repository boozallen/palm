import { trpc } from '@/libs';

export default function useUpdateUserGroupWorkflows() {
  const utils = trpc.useContext();

  return trpc.settings.updateUserGroupWorkflows.useMutation({
    onSuccess: (data, input) => {
      utils.settings.getUserGroup.setData(
        { id: input.userGroupId },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            workflowsEnabled: data.userGroup.workflowsEnabled,
          };
        }
      );
      utils.shared.getUserWorkflowsAccess.invalidate();
    },
  });
}