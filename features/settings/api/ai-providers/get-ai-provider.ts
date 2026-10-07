import { trpc } from '@/libs';

type useGetAiProviderConfig = {
  id: string;
}

export default function useGetAiProvider(config: useGetAiProviderConfig) {
  return trpc.settings.getAiProvider.useQuery(config, {
    enabled: !!config.id,
  });
}
