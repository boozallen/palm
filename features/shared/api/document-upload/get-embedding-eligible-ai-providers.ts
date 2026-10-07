import { trpc } from '@/libs';

export default function useGetEmbeddingEligibleAiProviders({ enabled = true }: { enabled?: boolean } = {}) {
  return trpc.shared.getEmbeddingEligibleAiProviders.useQuery(undefined, { enabled });
}
