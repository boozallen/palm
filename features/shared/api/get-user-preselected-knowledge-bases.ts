import { trpc } from '@/libs';

export default function useGetUserPreselectedKnowledgeBases() {
  return trpc.shared.getUserPreselectedKnowledgeBases.useQuery();
}
