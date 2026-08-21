import { trpc } from '@/libs';

export default function useGetUserKnowledgeBases() {
  return trpc.shared.getUserKnowledgeBases.useQuery(undefined);
}
