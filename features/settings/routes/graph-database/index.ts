import { router } from '@/server/trpc';
import getUserKnowledgeGraph from './get-user-knowledge-graph';
import getOverview from './get-overview';
import query from './query';

export default router({
  getUserKnowledgeGraph,
  getOverview,
  query,
});