import { trpc } from '@/libs';

export function useUpdateWorkflowShares() {
  const utils = trpc.useUtils();

  return trpc.workflows.updateWorkflowShares.useMutation({
    onSuccess: () => {
      utils.workflows.getSharedWorkflows.invalidate();
    },
  });
}
