import { trpc } from '@/libs';

export default function useGetPolicyRequirements() {
  return trpc.settings.getPolicyRequirements.useMutation();
}
