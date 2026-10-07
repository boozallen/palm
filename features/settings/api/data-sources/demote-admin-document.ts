import { trpc } from '@/libs';

export default function useDemoteAdminDocument() {
  return trpc.settings.dataSources.demoteAdminDocument.useMutation();
}
