import { router } from '@/server/trpc';
import buildGraph from './build-graph';
import cancelGraphBuild from './cancel-graph-build';
import getGraphStatus from './get-graph-status';
import getGraphedDocuments from './get-graphed-documents';
import getActiveGraphBuilds from './get-active-graph-builds';
import getUserProvidedGraphDocuments from './get-user-provided-graph-documents';

export default router({
  buildGraph,
  cancelGraphBuild,
  getGraphStatus,
  getGraphedDocuments,
  getActiveGraphBuilds,
  getUserProvidedGraphDocuments,
});
