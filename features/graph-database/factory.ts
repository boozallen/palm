import logger from '@/server/logger';
import { getConfig } from '@/server/config';
import {
  Neo4jSource,
  GraphDatabaseSource,
  GraphDatabaseProviderType,
  Neo4jConfig,
} from '@/features/graph-database/sources';

/**
 * Result returned by buildSource
 */
type BuildResult = {
  source: GraphDatabaseSource;
  providerType: GraphDatabaseProviderType;
};

// Singleton cache for connection reuse
let cachedSource: GraphDatabaseSource | null = null;
let connectionPromise: Promise<GraphDatabaseSource> | null = null;

/**
 * Reset the singleton cache (for testing only)
 */
export function _resetGraphDatabaseSourceForTesting(): void {
  cachedSource = null;
  connectionPromise = null;
}

/**
 * Factory for building graph database sources
 * 
 * Currently supports:
 * - Neo4j (from centralized config)
 */
export class GraphDatabaseFactory {
  async buildSource(): Promise<BuildResult> {
    try {
      const source = this.buildClient();

      return {
        source,
        providerType: GraphDatabaseProviderType.NEO4J,
      };
    } catch (cause) {
      const msg = '[GRAPH-FACTORY] Error building graph database source';
      logger.error(msg, cause);
      throw new Error(msg, { cause });
    }
  }

  private buildClient(): GraphDatabaseSource {
    // Get configuration from centralized config
    const appConfig = getConfig();

    // Currently only Neo4j is supported
    const config: Neo4jConfig = {
      providerType: GraphDatabaseProviderType.NEO4J,
      uri: appConfig.neo4j.uri,
      username: appConfig.neo4j.username,
      password: appConfig.neo4j.password,
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000,
    };
    return new Neo4jSource(config);
  }

  /**
   * Create and connect a graph database source in one step
   * This is a convenience method that combines buildSource + connect
   */
  async buildAndConnect(): Promise<BuildResult> {
    const result = await this.buildSource();
    await result.source.connect();
    return result;
  }
}

/**
 * Get the shared graph database source (singleton).
 *
 * This returns a single, shared Neo4j connection that is reused across
 * all queries. The Neo4j driver has built-in connection pooling (default 50),
 * so sharing one instance is more efficient than creating multiple drivers.
 *
 * For cases requiring a fresh connection (e.g., tests, migrations), use
 * GraphDatabaseFactory.buildAndConnect() directly.
 */
export async function getGraphDatabaseSource(): Promise<GraphDatabaseSource> {
  // Return existing connected instance
  if (cachedSource) {
    return cachedSource;
  }

  // If connection is in progress, wait for it (prevents race condition)
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection (only happens once)
  connectionPromise = (async () => {
    try {
      const factory = new GraphDatabaseFactory();
      const { source } = await factory.buildAndConnect();
      cachedSource = source;
      return source;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}
