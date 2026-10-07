import { trpc } from '@/libs';

export default function useGetAgentServices() {
  return trpc.settings.agentServices.getAgentServices.useQuery();
}
