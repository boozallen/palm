import { trpc } from '@/libs';

export default function useDemoteCollection() {
  return trpc.settings.dataSources.demoteCollection.useMutation();
}
