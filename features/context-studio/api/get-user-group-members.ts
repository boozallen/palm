import { trpc } from '@/libs';

export default function useGetUserGroupMembers(userGroupId: string, enabled: boolean) {
  return trpc.contextStudio.getUserGroupMembers.useQuery({ userGroupId }, { enabled });
}
