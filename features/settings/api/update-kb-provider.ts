import { trpc } from '@/libs';

export default function useUpdateKbProvider() {
  const utils = trpc.useContext();

  return trpc.settings.updateKbProvider.useMutation({
    onSuccess: (data) => {
      utils.settings.getKbProvider.setData(
        { id: data.provider.id },
        (oldData) => {
          if (!oldData) { return oldData; }

          return {
            kbProvider: data.provider,
          };
        }
      );

      utils.settings.getKbProviders.setData(undefined, (oldData) => {
        if (!oldData) { return oldData; }

        return {
          kbProviders: oldData.kbProviders.map((kbProvider) =>
            kbProvider.id === data.provider.id ? { ...data.provider } : kbProvider
          ),
        };
      });
    },
  });
}

