import { trpc } from '@/libs';

export default function useQuery() {
  return trpc.settings.graphDatabase.query.useMutation();
}
