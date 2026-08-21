import { trpc } from '@/libs';

export default function useGetUserGroupArtifactTemplates(userGroupId: string) {
  return trpc.settings.getUserGroupArtifactTemplates.useQuery(
    { id: userGroupId },
    { enabled: !!userGroupId },
  );
}
