import { trpc } from '@/libs';

/**
 * Cancel an in-progress graph build
 */
export default function useCancelGraphBuild() {
  return trpc.graph.cancelGraphBuild.useMutation();
}
