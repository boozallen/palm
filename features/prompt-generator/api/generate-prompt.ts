import { trpc } from '@/libs';

export function useGeneratePrompt() {
  return trpc.promptGenerator.generatePrompt.useMutation();
}
