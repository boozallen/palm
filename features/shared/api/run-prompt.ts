import { trpc } from '@/libs';

export function useRunPrompt() {
  return trpc.shared.runPrompt.useMutation();
}
