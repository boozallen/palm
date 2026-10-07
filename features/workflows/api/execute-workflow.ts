import { trpc } from '@/libs';

export const useExecuteWorkflow = () => {
  return trpc.workflows.executeWorkflow.useMutation();
};
