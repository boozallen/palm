/**
 * Graph Database Source Types
 *
 * This defines the interface that all graph database providers must implement.
 */

/**
 * Generic query result interface that can be adapted by different graph database providers
 */
export interface GraphQueryResult {
  records: Array<{
    get: (key: string) => any;
    keys: PropertyKey[];
    toObject: () => Record<string, any>;
  }>;
  summary?: {
    counters?: {
      updates: () => {
        relationshipsDeleted: number;
        nodesDeleted: number;
        nodesCreated: number;
        relationshipsCreated: number;
      };
    };
  };
}

/**
 * Session interface for running queries
 */
export interface GraphSession {
  run(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult>;
  beginTransaction(): GraphTransaction;
  close(): Promise<void>;
}

/**
 * Transaction interface for transactional operations
 */
export interface GraphTransaction {
  run(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Query batch for transactions
 */
export interface QueryBatch {
  query: string;
  parameters?: Record<string, any>;
}

/**
 * Main interface that all graph database sources must implement
 */
export interface GraphDatabaseSource {
  /**
   * Initialize the database connection
   */
  connect(): Promise<void>;

  /**
   * Get a new session for running queries
   */
  getSession(): Promise<GraphSession>;

  /**
   * Run a single query and return results
   */
  run(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult>;

  /**
   * Run multiple queries in a transaction
   */
  runTransaction(queries: QueryBatch[]): Promise<GraphQueryResult[]>;

  /**
   * Close the database connection
   */
  disconnect(): Promise<void>;

  /**
   * Health check to verify database connectivity
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get the provider type (e.g., 'neo4j', 'arangodb', 'tigergraph')
   */
  getProviderType(): string;
}

/**
 * Configuration for different graph database providers
 */
export enum GraphDatabaseProviderType {
  NEO4J = 'neo4j',
  // Future providers:
  // NEPTUNE = 'neptune',
}

/**
 * Base configuration that all providers need
 */
export interface GraphDatabaseConfig {
  providerType: GraphDatabaseProviderType;
}
