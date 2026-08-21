import { trpc } from '@/libs';

export function useAcknowledgeSecurityPolicy() {
  return trpc.shared.acknowledgeSecurityPolicy.useMutation();
}
