import { trpc } from '@/libs';

export const useUpdateWorkflow = () => {
  const utils = trpc.useUtils();
  return trpc.workflows.updateWorkflow.useMutation({
    onSuccess: (data, variables) => {
      utils.workflows.getWorkflow.invalidate({ workflowId: variables.workflowId });
      utils.workflows.getWorkflow.refetch({ workflowId: variables.workflowId });
      utils.workflows.getWorkflows.invalidate();
    },
  });
};
