import { trpc } from '@/libs';

export default function useGetDocumentUploadProviders() {
  return trpc.settings.getDocumentUploadProviders.useQuery();
}
