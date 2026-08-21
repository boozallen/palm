import { trpc } from '@/libs';

// Get all available models for a user.
export default function useGetAvailableModels({ enabled = true }: { enabled?: boolean } = {}) {
  return trpc.shared.getAvailableModels.useQuery({}, { enabled });
}
