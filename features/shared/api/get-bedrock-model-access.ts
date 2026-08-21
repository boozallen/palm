import { trpc } from '@/libs';

export function useGetBedrockModelAccess() {
  return trpc.shared.getBedrockModelAccess.useQuery();
}
