import { trpc } from '@/libs';

// Get all AI providers.
export default function useGetAiProviders() {
  return trpc.settings.getAiProviders.useQuery({});
}
