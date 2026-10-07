import { trpc } from '@/libs';

export const useGetWorkflowArtifactVersions = (artifactId: string) =>
  trpc.workflows.getWorkflowArtifactVersions.useQuery(
    { artifactId },
    { enabled: !!artifactId },
  );
