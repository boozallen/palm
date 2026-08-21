import { trpc } from '@/libs';

export default function usePromoteFromLibrary() {
  return trpc.settings.dataSources.promoteFromLibrary.useMutation();
}
