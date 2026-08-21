import { trpc } from '@/libs';

export function useGetSystemConfig({ enabled = true }: { enabled?: boolean } = {}) {
  return trpc.shared.getSystemConfig.useQuery(undefined, { enabled });
};
