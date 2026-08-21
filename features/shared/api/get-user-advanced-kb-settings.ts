import { trpc } from '@/libs';

export default function useGetUserAdvancedKbSettings() {
  return trpc.shared.getUserAdvancedKbSettings.useQuery();
}
