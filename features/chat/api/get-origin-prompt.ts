import { trpc } from '@/libs';

export default function useGetOriginPrompt(promptId: string | null) {
  return trpc.chat.getOriginPrompt.useQuery({ promptId: promptId || '' }, {
    enabled: !!promptId,
  });
}
