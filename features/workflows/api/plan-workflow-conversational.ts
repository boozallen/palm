import { trpc } from '@/libs';

export default function usePlanWorkflowConversational() {
  return trpc.workflows.planWorkflowConversational.useMutation();
}
