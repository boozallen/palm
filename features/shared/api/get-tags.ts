import { trpc } from '@/libs';

export function useGetTags(query: string) {
  return trpc.shared.getTags.useQuery({ query });
}
