import { trpc } from '@/libs';

interface ChatNetworkParams {
  documentIds: string[];
  limit?: number;
  labels?: string[];
  relationships?: string[];
}

interface UseChatNetworkOptions {
  enabled?: boolean;
}

export default function useChatNetwork(
  params: ChatNetworkParams, 
  options: UseChatNetworkOptions = {}
) {
  return trpc.chat.graphDatabase.getNetwork.useQuery(params, options);
}