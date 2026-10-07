import { trpc } from '@/libs';

export default function useGetAdminDataSourcePresignedUrl() {
  return trpc.settings.dataSources.getPresignedUrl.useMutation();
}
