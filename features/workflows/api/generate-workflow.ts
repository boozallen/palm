import { trpc } from '@/libs';

export default function useGenerateWorkflow() {
  return trpc.workflows.generateWorkflow.useMutation();
}
