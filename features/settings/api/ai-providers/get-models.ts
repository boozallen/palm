import { trpc } from '@/libs';

// Get all AI models.
export default function useGetModels() {
  return trpc.settings.getModels.useQuery();
}
