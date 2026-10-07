import { trpc } from '@/libs';

export function useGetDocumentLibraryDataSharingEnabled() {
  return trpc.shared.getDocumentLibraryDataSharingEnabled.useQuery();
}