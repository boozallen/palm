import { getGraphDatabaseSource } from '@/features/graph-database';
import { SearchParams, SearchResult } from '@/features/settings/types/graph-database';
import logger from '@/server/logger';

/**
 * Executes a custom Cypher query against the graph database
 * Write operations are blocked unless allowWrite is true
 */
export default async function query(params: SearchParams): Promise<SearchResult> {
  const { query, allowWrite } = params;

  logger.debug(`[DAL-GRAPH-SEARCH] Executing query: ${query.substring(0, 100)}...`);

  // Basic security check - block write operations unless allowWrite is true
  const normalizedQuery = query.trim().toLowerCase();
  const writeOperations = ['create', 'merge', 'delete', 'remove', 'set', 'detach', 'drop', 'load csv'];
  const hasWriteOperation = writeOperations.some(op => normalizedQuery.includes(op));

  if (hasWriteOperation && !allowWrite) {
    logger.warn(`[DAL-GRAPH-SEARCH] Blocked write operation attempt: ${query}`);
    throw new Error('Write operations are not allowed. Only read queries (MATCH, RETURN, etc.) are permitted.');
  }

  if (hasWriteOperation) {
    logger.info(`[DAL-GRAPH-SEARCH] Executing write operation: ${query.substring(0, 100)}...`);
  }

  try {
    const graphSource = await getGraphDatabaseSource();
    const session = await graphSource.getSession();

    try {
      const result = await session.run(query);
      
      const records = result.records.map(record => {
        const recordObj: any = {};
        record.keys.forEach((key) => {
          recordObj[key] = record.get(String(key));
        });
        return recordObj;
      });
      
      const counters = hasWriteOperation
        ? (result as any).summary?.counters?.updates()
        : undefined;

      const searchResult: SearchResult = {
        results: records,
        recordCount: records.length,
        summary: {
          queryType: hasWriteOperation ? 'write' : 'read',
          executionTime: typeof (result as any).summary?.resultAvailableAfter === 'object' && (result as any).summary.resultAvailableAfter.toNumber
            ? (result as any).summary.resultAvailableAfter.toNumber()
            : (result as any).summary?.resultAvailableAfter || 0,
          ...(counters && {
            counters: {
              nodesCreated: counters.nodesCreated ?? 0,
              nodesDeleted: counters.nodesDeleted ?? 0,
              relationshipsCreated: counters.relationshipsCreated ?? 0,
              relationshipsDeleted: counters.relationshipsDeleted ?? 0,
              propertiesSet: counters.propertiesSet ?? 0,
              labelsAdded: counters.labelsAdded ?? 0,
              labelsRemoved: counters.labelsRemoved ?? 0,
            },
          }),
        },
      };

      logger.debug(`[DAL-GRAPH-SEARCH] Query returned ${records.length} records`);
      return searchResult;
    } finally {
      await session.close();
    }
  } catch (error) {
    logger.error('Error executing graph search query', error);
    throw new Error('Error executing graph search query');
  }
}
