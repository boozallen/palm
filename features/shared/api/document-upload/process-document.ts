import { trpc } from '@/libs';

export default function useProcessDocument(
  options?: Parameters<typeof trpc.shared.processDocument.useMutation>[0]
) {
  return trpc.shared.processDocument.useMutation(options);
}