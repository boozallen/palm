import db from '@/server/db';
import logger from '@/server/logger';
import { DatabaseQueryResult } from '@/features/settings/types/databases';

const MAX_ROWS = 1000;
const QUERY_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Executes a read-only query on the database
 * Uses SET TRANSACTION READ ONLY for database-level enforcement
 * Enforces row limit and timeout to prevent resource exhaustion
 */
export default async function executeReadOnlyQuery(
  query: string,
): Promise<DatabaseQueryResult> {
  try {
    // Execute query in a read-only transaction with timeout
    const startTime = Date.now();

    const result = await db.$transaction(
      async (tx) => {
        // Set transaction to read-only at the database level
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');

        // Set statement timeout
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${QUERY_TIMEOUT_MS}ms'`);

        // Execute the user query with row limit
        // Strip trailing semicolon before appending LIMIT
        const trimmedQuery = query.trim().replace(/;+$/, '');

        // Check if query already has a LIMIT clause and extract the value
        const limitMatch = /\bLIMIT\s+(\d+)\b/i.exec(trimmedQuery);
        let limitedQuery: string;

        if (limitMatch) {
          const userLimit = parseInt(limitMatch[1], 10);
          // Replace user's limit with the minimum of their limit and MAX_ROWS
          const enforcedLimit = Math.min(userLimit, MAX_ROWS);
          limitedQuery = trimmedQuery.replace(/\bLIMIT\s+\d+\b/i, `LIMIT ${enforcedLimit}`);
        } else {
          // No limit specified, append default
          limitedQuery = `${trimmedQuery} LIMIT ${MAX_ROWS}`;
        }

        const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(limitedQuery);

        return rows;
      },
      {
        timeout: QUERY_TIMEOUT_MS,
      },
    );

    const executionTime = Date.now() - startTime;

    // Extract column names from first row
    const columns = result.length > 0 ? Object.keys(result[0]) : [];

    return {
      columns,
      rows: result,
      rowCount: result.length,
      executionTime,
    };
  } catch (error) {
    logger.error('Error executing read-only query', { error, query });

    if ((error as Error).message.includes('canceling statement due to statement timeout')) {
      throw new Error(`Query exceeded timeout limit of ${QUERY_TIMEOUT_MS / 1000} seconds`);
    }

    throw new Error(`Failed to execute query: ${(error as Error).message}`);
  }
}
