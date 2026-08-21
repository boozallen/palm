import { trpc } from '@/libs';

// Get all KB providers.
export default function useGetKbProviders() {
  return trpc.settings.getKbProviders.useQuery();
}
