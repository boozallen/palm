import { trpc } from '@/libs';

type GetPromptStatsConfig = {
  promptIds: string[];
};

export function useGetPromptStats(config: GetPromptStatsConfig) {
  return trpc.library.getPromptStats.useQuery(config, {
    enabled: config.promptIds.length > 0,
  });
}