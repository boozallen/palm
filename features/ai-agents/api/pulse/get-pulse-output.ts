import { trpc } from '@/libs';
import type { PulseOutputKind } from '@/features/ai-agents/types/pulse/results';

type PulseOutputParams = {
  agentId: string;
  jobId: string;
  output: PulseOutputKind;
};

// Fetched on demand from a download button rather than on render.
export default function usePulseOutput() {
  const utils = trpc.useUtils();

  return {
    fetch: async (params: PulseOutputParams) => utils.aiAgents.getPulseOutput.fetch(params),
  };
}
