import { trpc } from '@/libs';

export default function useGetCertaRequirements(options?: { enabled?: boolean }) {
  return trpc.settings.getCertaRequirements.useQuery(undefined, options);
}
