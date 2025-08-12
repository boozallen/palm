import { trpc } from '@/libs';

export default function useGetHasOpenAiModel() {
  return trpc.shared.getHasOpenAiModel.useQuery();
}
