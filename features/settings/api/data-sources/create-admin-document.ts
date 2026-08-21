import { trpc } from '@/libs';

export default function useCreateAdminDocument() {
  return trpc.settings.dataSources.createAdminDocument.useMutation();
}
