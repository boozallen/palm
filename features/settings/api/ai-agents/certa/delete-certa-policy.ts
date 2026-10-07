import { trpc } from '@/libs';

export default function useDeleteCertaPolicy() {
  const utils = trpc.useUtils();
  return trpc.settings.deleteCertaPolicy.useMutation({
    onSuccess: (data) => {
      utils.settings.getCertaPolicies.setData({ id: data.aiAgentId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        const newData = {
          policies: oldData.policies.filter((policy) => policy.id !== data.id),
        };

        return newData;
      });
    },
  });
}
