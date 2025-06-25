import { trpc } from '@/libs';

export default function useGetSystemAdmins() {
  return trpc.settings.getSystemAdmins.useQuery();
}
