import { trpc } from '@/libs';

export const useGetWorkflows = (input?: {
  limit?: number;
  offset?: number;
  userGroupId?: string;
}) => {
  return trpc.workflows.getWorkflows.useQuery(input);
};
