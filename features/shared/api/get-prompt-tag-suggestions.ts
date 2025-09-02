import { trpc } from '@/libs';

export default function useGetPromptTagSuggestions() {
  return trpc.shared.getPromptTagSuggestions.useMutation();
}
