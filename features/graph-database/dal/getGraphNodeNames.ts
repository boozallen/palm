import { getGraphDatabaseSource } from '@/features/graph-database';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

type GetGraphNodeNamesInput = {
  ids: string[];
  accessibleDocumentIds: AccessibleDocIds;
};

export type GraphNodeName =
  | { id: string; name: string | null; kind: 'entity' | 'concept'; found: true }
  | { id: string; name: null; kind: null; found: false };

// Scoped to the caller's accessible documents so an id outside their graph
// resolves to found: false instead of leaking another user's node name.
const RESOLVE_NODE_NAMES_QUERY = `
  UNWIND $ids AS nid
  OPTIONAL MATCH (n:Entity|Concept {id: nid})
  WHERE n.documentId IN $documentIds
  RETURN nid AS id,
         n.name AS name,
         CASE WHEN n IS NULL THEN null WHEN n:Entity THEN 'entity' ELSE 'concept' END AS kind
`;

export default async function getGraphNodeNames({
  ids,
  accessibleDocumentIds,
}: GetGraphNodeNamesInput): Promise<GraphNodeName[]> {
  if (ids.length === 0) {
    return [];
  }

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(RESOLVE_NODE_NAMES_QUERY, {
      ids,
      documentIds: Array.from(accessibleDocumentIds),
    });
    return result.records.map((record): GraphNodeName => {
      const id = record.get('id') as string;
      const kind = record.get('kind') as 'entity' | 'concept' | null;
      if (kind === null) {
        return { id, name: null, kind: null, found: false };
      }
      return { id, name: record.get('name') as string | null, kind, found: true };
    });
  } catch (error) {
    logger.error('Error resolving graph node names', { idCount: ids.length, error });
    throw new Error('Error resolving graph node names');
  }
}
