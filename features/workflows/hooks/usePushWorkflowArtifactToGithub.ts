import { trpc } from '@/libs';

export const usePushWorkflowArtifactToGithub = () => {
  return trpc.workflows.pushWorkflowArtifactToGithub.useMutation();
};
