import { trpc } from '@/libs';

export const useDeleteWorkflow = () => {
  return trpc.workflows.deleteWorkflow.useMutation();
};