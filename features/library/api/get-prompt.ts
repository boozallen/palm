import { trpc } from '@/libs';

export type UseGetPromptOptions = {
  promptId: string;
};

export function useGetPrompt({ promptId }: UseGetPromptOptions) {
  return trpc.library.getPrompt.useQuery({ promptId }, {
    enabled: !!promptId,
  });
}
