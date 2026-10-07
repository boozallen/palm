import { trpc } from '@/libs';

export const useSaveWorkflowArtifactVersion = () => {
  const utils = trpc.useUtils();

  return trpc.workflows.saveWorkflowArtifactVersion.useMutation({
    onSuccess: (data) => {
      utils.workflows.getWorkflowArtifact.invalidate({ artifactId: data.artifactId });
      utils.workflows.getWorkflowArtifactVersions.invalidate({ artifactId: data.artifactId });
    },
  });
};
