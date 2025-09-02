import { trpc } from '@/libs';

export default function useGenerateUserGroupJoinCode() {
  const utils = trpc.useContext();

  return trpc.settings.generateUserGroupJoinCode.useMutation({
    onSuccess: (data) => {
      utils.settings.getUserGroup.setData({ id: data.id }, (_oldData) => {
        return data;
      });
    },
  });
}
