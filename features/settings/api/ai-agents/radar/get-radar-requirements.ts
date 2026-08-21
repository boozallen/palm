import { trpc } from '@/libs';

export default function useGetRadarRequirements(options?: { enabled?: boolean }) {
  return trpc.settings.getRadarRequirements.useQuery(undefined, options);
}
