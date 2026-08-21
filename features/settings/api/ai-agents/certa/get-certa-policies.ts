import { trpc } from '@/libs';

export default function useGetCertaPolicies(id: string) {
  return trpc.settings.getCertaPolicies.useQuery({ id });
}
