import { trpc } from '@/libs';

export default function useExportMarginAnalysis() {
  return trpc.aiAgents.exportMarginAnalysis.useMutation();
}
