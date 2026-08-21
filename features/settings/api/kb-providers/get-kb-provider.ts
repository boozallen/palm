import { trpc } from '@/libs';

export default function useGetKbProvider(kbProviderId: string) {
  return trpc.settings.getKbProvider.useQuery({ id: kbProviderId });
}
