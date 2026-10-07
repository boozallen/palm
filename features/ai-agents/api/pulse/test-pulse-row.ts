import { trpc } from '@/libs';

export default function useTestPulseRow() {
  return trpc.aiAgents.testPulseRow.useMutation();
}
