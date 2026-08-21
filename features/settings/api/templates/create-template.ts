import { trpc } from '@/libs';

export default function useCreateTemplate() {
  const utils = trpc.useUtils();

  return trpc.settings.createTemplate.useMutation({
    onSuccess: () => {
      utils.settings.listTemplates.invalidate();
    },
  });
}
