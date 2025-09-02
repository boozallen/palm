import { trpc } from '@/libs';

export default function useGetAiAgent(id: string) {
  return trpc.settings.getAiAgent.useQuery({ id });
}
