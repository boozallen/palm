import { trpc } from '@/libs';

export default function useGetOverview() {
  return trpc.settings.graphDatabase.getOverview.useQuery();
}