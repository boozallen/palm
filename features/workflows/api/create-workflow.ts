import { trpc } from '@/libs';

export const useCreateWorkflow = () => {
  return trpc.workflows.createWorkflow.useMutation();
};
