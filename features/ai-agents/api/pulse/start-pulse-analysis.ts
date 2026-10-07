import { trpc } from '@/libs';

export default function useStartPulseAnalysis() {
  return trpc.aiAgents.startPulseAnalysis.useMutation();
}
