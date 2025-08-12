import { trpc } from '@/libs';

export default function useUpdateCertaPolicy() {
  const utils = trpc.useUtils();
  return trpc.settings.updateCertaPolicy.useMutation({
    onSuccess: (data) => {
      utils.settings.getCertaPolicies.setData({ id: data.aiAgentId }, (oldData) => {
        if (!oldData) {
          return oldData;
        }
        
        const newData = {
          policies: oldData.policies.map((policy) => 
            policy.id === data.id ? data : policy
          ),
        };
        
        return newData;
      });
    },
  });
}
