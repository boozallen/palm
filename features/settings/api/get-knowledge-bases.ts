import { trpc } from '@/libs';

// Get all knowledge bases.
export default function useGetKnowledgeBases() {
  return trpc.settings.getKnowledgeBases.useQuery();
}
