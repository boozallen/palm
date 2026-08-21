import { trpc } from '@/libs';

export const useContinueWorkflowExecution = () => {
  return trpc.workflows.continueWorkflowExecution.useMutation();
};
