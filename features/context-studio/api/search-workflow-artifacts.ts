import { trpc } from '@/libs';
import { WorkflowArtifactSearchQuery } from '@/features/context-studio/types/chat-search';

export default function useSearchWorkflowArtifacts(
  query: WorkflowArtifactSearchQuery,
  enabled: boolean,
) {
  return trpc.contextStudio.searchWorkflowArtifacts.useQuery(query, {
    enabled,
  });
}
