import { trpc } from '@/libs';

export default function useGetPresignedUrl() {
  return trpc.shared.getPresignedUrl.useMutation();
}