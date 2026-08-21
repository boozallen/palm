import { trpc } from '@/libs';

export default function useGetTemplates() {
  return trpc.settings.listTemplates.useQuery({});
}
