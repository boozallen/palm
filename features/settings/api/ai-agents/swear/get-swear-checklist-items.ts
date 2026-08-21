import { trpc } from '@/libs';

export default function useGetSwearChecklistItems(id: string) {
  return trpc.settings.getSwearChecklistItems.useQuery({ id });
}
