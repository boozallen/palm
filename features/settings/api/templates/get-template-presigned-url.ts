import { trpc } from '@/libs';

export default function useGetTemplatePresignedUrl() {
  return trpc.settings.getTemplatePresignedUrl.useMutation();
}
