import { trpc } from '@/libs';

export function useGetSystemConfig() {
  return trpc.shared.getSystemConfig.useQuery();
};
