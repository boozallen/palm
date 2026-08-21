import { trpc } from '@/libs';

export default function useGetAdminDocuments() {
  return trpc.settings.dataSources.getAdminDocuments.useQuery(undefined);
}
