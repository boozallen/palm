import { trpc } from '@/libs';
import { ArtifactSearchQuery } from '@/features/context-studio/types/artifact-search';

export default function useSearchArtifacts(query: ArtifactSearchQuery, enabled: boolean) {
  return trpc.contextStudio.searchArtifacts.useQuery(query, {
    enabled,
  });
}
