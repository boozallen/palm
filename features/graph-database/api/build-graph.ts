import { trpc } from '@/libs';

/**
 * Trigger graph build for a set of documents
 * Returns graphId, status, and jobId
 */
export default function useBuildGraph() {
  const utils = trpc.useUtils();
  return trpc.graph.buildGraph.useMutation({
    onSuccess: () => {
      // So the "Cancelling…"-aware popover/badges appear promptly once this
      // build is picked up, rather than waiting for the next poll tick.
      utils.graph.getActiveGraphBuilds.invalidate();
    },
  });
}
