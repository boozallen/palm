import { trpc } from '@/libs';

export default function useGetDocumentContent({ documentId }: { documentId: string | undefined }) {
  return trpc.shared.getDocumentContent.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );
}
