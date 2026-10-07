import { trpc } from '@/libs';

export default function useGetArtifactVersions(artifactId: string, chatMessageId: string) {
  return trpc.chat.getArtifactVersions.useQuery(
    { artifactId, chatMessageId },
    { enabled: !!artifactId && !!chatMessageId },
  );
}
