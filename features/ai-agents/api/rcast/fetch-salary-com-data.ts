import { trpc } from '@/libs';

export default function useFetchSalaryComData() {
  return trpc.aiAgents.fetchSalaryComData.useMutation();
}
