import { trpc } from '@/libs';

export default function useGetDocumentUploadRequirements() {
  return trpc.settings.getDocumentUploadRequirements.useQuery();
}
