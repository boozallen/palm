import { trpc } from '@/libs';

type GetPromptsConfig = {
  tabFilter?: string
  search?: string,
  tags?: string[],
};

export function useGetPrompts(config: GetPromptsConfig) {
  return trpc.library.getPrompts.useQuery(config);
}
