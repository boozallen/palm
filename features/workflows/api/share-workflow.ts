import { trpc } from '@/libs';

export function useShareWorkflow() {
  const utils = trpc.useUtils();

  return trpc.workflows.shareWorkflow.useMutation({
    onSuccess: () => {
      utils.workflows.getSharedWorkflows.invalidate();
    },
  });
}
