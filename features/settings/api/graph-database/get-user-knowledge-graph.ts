import { trpc } from '@/libs';

interface UserKnowledgeGraphParams {
  limit?: number;
  labels?: string[];
  relationships?: string[];
}

interface UseGetUserKnowledgeGraphOptions {
  enabled?: boolean;
}

export default function useGetUserKnowledgeGraph(
  params: UserKnowledgeGraphParams, 
  options: UseGetUserKnowledgeGraphOptions = {}
) {
  return trpc.settings.graphDatabase.getUserKnowledgeGraph.useQuery(params, options);
}