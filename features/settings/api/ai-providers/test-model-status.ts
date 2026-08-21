import { trpc } from '@/libs';

export default function useTestModelStatus() {
  return trpc.settings.testModelStatus.useMutation();
}
