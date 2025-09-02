import { trpc } from '@/libs';

export default function useGetDocumentUploadRequirements() {
  return trpc.shared.getDocumentUploadRequirements.useQuery();
}
