import { trpc } from '@/libs';

export default function useGetUserEnabledAiAgents() {
  return trpc.shared.getUserEnabledAiAgents.useQuery();
}
