import { getGraphDatabaseSource } from '@/features/graph-database';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

type ResolveGraphNodesByNameInput = {
  names: string[];
  kind: 'entity' | 'concept';
  accessibleDocumentIds: AccessibleDocIds;
};

export type ResolvedGraphName = {
  name: string;
  ids: string[];
};

// Deliberately deterministic: case-insensitive exact match on name or alias,
// never similarity. A name resolves to EVERY matching node (the same
// real-world thing exists once per document), scoped to the caller's
// accessible documents. Only Entity nodes carry aliases at ingestion, so the
// alias clause exists only in the Entity variant.
const buildResolveByNameQuery = (label: 'Entity' | 'Concept') => {
  const aliasClause = label === 'Entity'
    ? `
         OR any(alias IN coalesce(n.aliases, []) WHERE toLower(alias) = toLower(wanted))`
    : '';
  return `
  UNWIND $names AS wanted
  OPTIONAL MATCH (n:${label})
  WHERE n.documentId IN $documentIds
    AND (toLower(n.name) = toLower(wanted)${aliasClause})
  RETURN wanted AS name, collect(n.id) AS ids
`;
};

export default async function resolveGraphNodesByName({
  names,
  kind,
  accessibleDocumentIds,
}: ResolveGraphNodesByNameInput): Promise<ResolvedGraphName[]> {
  if (names.length === 0) {
    return [];
  }

  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(
      buildResolveByNameQuery(kind === 'entity' ? 'Entity' : 'Concept'),
      {
        names,
        documentIds: Array.from(accessibleDocumentIds),
      },
    );
    return result.records.map((record) => ({
      name: record.get('name') as string,
      ids: record.get('ids') as string[],
    }));
  } catch (error) {
    logger.error('Error resolving graph nodes by name', { kind, nameCount: names.length, error });
    throw new Error('Error resolving graph nodes by name');
  }
}
