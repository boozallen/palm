import { trpc } from '@/libs';

type UseGetDocumentsProps = {
  documentUploadProviderId: string;
  enabled?: boolean;
};

export default function useGetDocuments({ documentUploadProviderId, enabled = true }: UseGetDocumentsProps) {
  return trpc.settings.dataSources.getDocuments.useQuery(
    { documentUploadProviderId },
    { enabled: enabled && !!documentUploadProviderId }
  );
}
