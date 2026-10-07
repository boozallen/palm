import { trpc } from '@/libs';

export default function useTestAgentService() {
  return trpc.settings.agentServices.testAgentService.useMutation();
}
