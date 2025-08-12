import { trpc } from '@/libs';

// Get all available models for a user.
export default function useGetAvailableModels() {
  return trpc.shared.getAvailableModels.useQuery({});
}
