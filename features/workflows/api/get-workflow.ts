import { trpc } from '@/libs';

export const useGetWorkflow = (workflowId: string) => {
  return trpc.workflows.getWorkflow.useQuery(
    { workflowId },
    { enabled: !!workflowId }
  );
};
