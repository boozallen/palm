import { trpc } from '@/libs';

export default function useDeleteTemplate() {
  const utils = trpc.useUtils();

  return trpc.settings.deleteTemplate.useMutation({
    onSuccess: (data) => {
      utils.settings.listTemplates.setData({}, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        return {
          templates: oldData.templates.filter((template) => template.id !== data.id),
        };
      });
    },
  });
}
