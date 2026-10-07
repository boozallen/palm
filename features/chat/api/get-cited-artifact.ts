import { trpc } from '@/libs';

type GetCitedArtifactParams = {
  artifactId: string;
};

export default function useGetCitedArtifact() {
  const utils = trpc.useUtils();

  return {
    fetch: (params: GetCitedArtifactParams) => utils.chat.getCitedArtifact.fetch(params),
  };
}
