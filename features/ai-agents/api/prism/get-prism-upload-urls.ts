import { trpc } from '@/libs';

export default function useGetPrismUploadUrls() {
  return trpc.aiAgents.getPrismUploadUrls.useMutation();
}
