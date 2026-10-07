import { trpc } from '@/libs';

export function useCopyWorkflow() {
  const utils = trpc.useUtils();

  return trpc.workflows.copyWorkflow.useMutation({
    onSuccess: () => {
      utils.workflows.getWorkflows.invalidate();
    },
  });
}
