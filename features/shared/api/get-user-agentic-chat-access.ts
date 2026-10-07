import { trpc } from '@/libs';

export function useGetUserAgenticChatAccess() {
  return trpc.shared.getUserAgenticChatAccess.useQuery();
}
