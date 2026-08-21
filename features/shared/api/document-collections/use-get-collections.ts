import { trpc } from '@/libs';

export default function useGetCollections() {
  return trpc.shared.documentCollections.getCollections.useQuery();
}
