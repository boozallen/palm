import { router } from '@/server/trpc';
import getNetwork from './get-network';
import getNodeNeighbors from './get-node-neighbors';
import getNodeNeighborCount from './get-node-neighbor-count';
import findShortestPath from './find-shortest-path';
import getEdgesBetween from './get-edges-between';

export default router({
  getNetwork,
  getNodeNeighbors,
  getNodeNeighborCount,
  findShortestPath,
  getEdgesBetween,
});