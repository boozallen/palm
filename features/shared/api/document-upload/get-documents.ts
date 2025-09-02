import { trpc } from '@/libs';
import { DocumentUploadStatus } from '@/features/shared/types/document';

export default function useGetDocuments({ documentUploadProviderId }: { documentUploadProviderId: string }) {
  const query = trpc.shared.getDocuments.useQuery(
    { documentUploadProviderId },
    {
      refetchInterval: (query) => {
        // If there are any pending documents, poll every 3 seconds
        const data = query.state.data;
        if (!data) {
          return false; 
        }
        const hasPendingDocuments = data.documents.some(
          (doc) => doc.uploadStatus === DocumentUploadStatus.Pending
        );
        return hasPendingDocuments ? 3000 : false;
      },
    }
  );
  return query;
}
