import { trpc } from '@/libs';

export function useUpdateSystemConfig() {
  const utils = trpc.useContext();

  return trpc.settings.updateSystemConfig.useMutation({
    onSuccess: (data) => {
      utils.shared.getSystemConfig.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          ...oldData,
          [data.updatedField]: data.updatedValue,
        };
      });
    },
  });
}
