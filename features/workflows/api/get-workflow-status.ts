import { trpc } from '@/libs';

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export const useGetWorkflowStatus = (executionId: string | null) => {
  return trpc.workflows.getWorkflowStatus.useQuery(
    { executionId: executionId! },
    {
      enabled: !!executionId,
      refetchInterval: (query) => {
        const status = query.state.data?.execution?.status;
        if (status && TERMINAL_STATUSES.includes(status)) { return false; }
        return 2000;
      },
    }
  );
};
