import { trpc } from '@/libs';

export default function useAnalyzeProposal() {
  return trpc.aiAgents.analyzeProposal.useMutation();
}
