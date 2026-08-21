import { trpc } from '@/libs';

export const useCancelWorkflowExecution = () => {
  return trpc.workflows.cancelWorkflowExecution.useMutation();
};
