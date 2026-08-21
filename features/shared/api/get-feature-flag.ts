import { trpc } from '@/libs';

export interface Feature {
  feature: string;
};

export function useGetFeatureFlag({ feature }: Feature) {
  return trpc.shared.getFeatureFlag.useQuery({ feature });
}

