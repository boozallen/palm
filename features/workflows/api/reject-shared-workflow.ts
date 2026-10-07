import { trpc } from '@/libs';

export function useRejectSharedWorkflow() {
  const utils = trpc.useContext();

  return trpc.workflows.rejectSharedWorkflow.useMutation({
    onSuccess: () => {
      utils.workflows.getSharedWorkflows.invalidate();
    },
  });
}
