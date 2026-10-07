import { trpc } from '@/libs';

export default function useAssignAdminDocumentGroups() {
  return trpc.settings.dataSources.assignGroups.useMutation();
}
