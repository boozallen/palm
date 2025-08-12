import { trpc } from '@/libs';

export default function useUploadDocument() {
  const utils = trpc.useUtils();

  return trpc.shared.uploadDocument.useMutation({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });
}
