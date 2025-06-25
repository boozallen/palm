import { trpc } from '@/libs';

export default function useAddKbProvider() {
  const utils = trpc.useContext();

  return trpc.settings.addKbProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getKbProviders.setData(undefined, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          kbProviders: [
            ...oldData.kbProviders,
            {
              id: data.kbProvider.id,
              label: data.kbProvider.label,
              kbProviderType: data.kbProvider.kbProviderType,
              writeAccess: data.kbProvider.writeAccess,
              config: data.kbProvider.config,
              createdAt: data.kbProvider.createdAt,
              updatedAt: data.kbProvider.updatedAt,
            },
          ],
        };
      });

      utils.settings.getKbProvider.setData({ id: data.kbProvider.id }, () => {
        return {
          kbProvider: data.kbProvider,
        };
      });
    },
  });
}
