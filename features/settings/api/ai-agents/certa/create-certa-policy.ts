import { trpc } from '@/libs';

export default function useCreateCertaPolicy() {
  const utils = trpc.useUtils();

  return trpc.settings.createCertaPolicy.useMutation({
    onSuccess: (data) => {
      utils.settings.getCertaPolicies.setData({ id: data.aiAgentId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          policies: [...oldData.policies, data],
        };

        return newData;
      });
    },
  });
}
