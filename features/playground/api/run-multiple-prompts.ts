import { trpc } from '@/libs';

export function useRunMultiplePrompts() {
  return trpc.playground.playgroundPrompt.useMutation();
}
