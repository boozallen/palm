import { trpc } from '@/libs';

export function useGetMarginUploadUrl() {
  return trpc.aiAgents.getMarginUploadUrl.useMutation();
}
