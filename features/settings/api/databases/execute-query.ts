import { trpc } from '@/libs/trpc';

export default function useExecuteQuery() {
  return trpc.settings.databases.executeQuery.useMutation();
}
