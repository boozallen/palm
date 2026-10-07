import { trpc } from '@/libs';

export default function useGetPulseUploadUrl() {
  return trpc.aiAgents.getPulseUploadUrl.useMutation();
}
