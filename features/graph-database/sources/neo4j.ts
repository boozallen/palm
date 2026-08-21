/**
 * Neo4j implementation of GraphDatabaseSource
 */

import neo4j, { Driver, Session as Neo4jSession, QueryResult as Neo4jQueryResult } from 'neo4j-driver';
import { logger } from '@/server/logger';
import {
  GraphDatabaseSource,
  GraphQueryResult,
  GraphSession,
  GraphTransaction,
  QueryBatch,
  GraphDatabaseProviderType,
} from '@/features/graph-database/sources/types';

/**
 * Neo4j-specific configuration
 */
export interface Neo4jConfig {
  providerType: GraphDatabaseProviderType.NEO4J;
  uri: string;
  username: string;
  password: string;
  maxConnectionPoolSize?: number;
  connectionAcquisitionTimeout?: number;
}

/**
 * Adapter to convert Neo4j Session to GraphSession interface
 */
class Neo4jSessionAdapter implements GraphSession {
  constructor(private session: Neo4jSession) {}

  async run(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult> {
    const result = await this.session.run(query, parameters);
    return this.adaptQueryResult(result);
  }

  beginTransaction(): GraphTransaction {
    const tx = this.session.beginTransaction();
    return {
      run: async (query: string, parameters?: Record<string, any>) => {
        const result = await tx.run(query, parameters);
        return this.adaptQueryResult(result);
      },
      commit: () => tx.commit(),
      rollback: () => tx.rollback(),
    };
  }

  async close(): Promise<void> {
    await this.session.close();
  }

  private adaptQueryResult(result: Neo4jQueryResult): GraphQueryResult {
    return {
      records: result.records.map(record => ({
        get: (key: string) => {
          const value = record.get(key);
          return this.convertNeo4jTypes(value);
        },
        keys: record.keys,
        toObject: () => record.toObject(),
      })),
      summary: result.summary ? {
        counters: {
          updates: () => ({
            relationshipsDeleted: result.summary.counters.updates().relationshipsDeleted,
            nodesDeleted: result.summary.counters.updates().nodesDeleted,
            nodesCreated: result.summary.counters.updates().nodesCreated,
            relationshipsCreated: result.summary.counters.updates().relationshipsCreated,
          }),
        },
      } : undefined,
    };
  }

  private convertNeo4jTypes(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    // Handle Neo4j Integer
    if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return value.toNumber();
    }
    
    // Handle Neo4j Node
    if (value && typeof value === 'object' && 'identity' in value && 'labels' in value && 'properties' in value) {
      return {
        identity: this.convertNeo4jTypes(value.identity),
        labels: value.labels,
        properties: this.convertNeo4jTypes(value.properties),
      };
    }
    
    // Handle Neo4j Relationship
    if (value && typeof value === 'object' && 'identity' in value && 'type' in value && 'properties' in value) {
      return {
        identity: this.convertNeo4jTypes(value.identity),
        type: value.type,
        properties: this.convertNeo4jTypes(value.properties),
        start: this.convertNeo4jTypes(value.start),
        end: this.convertNeo4jTypes(value.end),
      };
    }
    
    // Handle objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const converted: any = {};
      for (const [k, v] of Object.entries(value)) {
        converted[k] = this.convertNeo4jTypes(v);
      }
      return converted;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.convertNeo4jTypes(item));
    }
    
    return value;
  }
}

/**
 * Neo4j implementation of GraphDatabaseSource
 *
 * This is a non-singleton implementation that follows the factory pattern used by ai-provider and document-upload-provider.
 */
export class Neo4jSource implements GraphDatabaseSource {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor(config: Neo4jConfig) {
    this.config = config;
  }

  /**
   * Initialize the Neo4j driver connection
   */
  async connect(): Promise<void> {
    if (this.driver) {
      logger.info('[NEO4J-SOURCE] Driver already connected');
      return;
    }

    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50,
          connectionAcquisitionTimeout: this.config.connectionAcquisitionTimeout || 2 * 60 * 1000, // 2 minutes
        }
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      logger.info('[NEO4J-SOURCE] Driver connected successfully', {
        uri: this.config.uri,
      });

      // Create constraints and indexes
      await this.createConstraintsAndIndexes();
    } catch (error) {
      logger.error('[NEO4J-SOURCE] Failed to connect to Neo4j:', error);
      throw new Error('Neo4j connection failed');
    }
  }

  /**
   * Create database constraints and indexes for optimal performance
   */
  private async createConstraintsAndIndexes(): Promise<void> {
    if (!this.driver) {
      throw new Error('[NEO4J-SOURCE] Driver not initialized');
    }
    const session = this.driver.session();

    try {
      // Unique constraints (also create indexes automatically)
      await session.run(
        'CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT concept_id IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE'
      );
      // Structural join point for a resolved entity/concept cluster (owns no
      // content — see .agents/plans/entity-resolution-identity-cluster-hubs.md).
      await session.run(
        'CREATE CONSTRAINT identity_cluster_id IF NOT EXISTS FOR (h:IdentityCluster) REQUIRE h.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT conversation_chat_id IF NOT EXISTS FOR (c:Chat) REQUIRE c.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT conversation_message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT conversation_artifact_id IF NOT EXISTS FOR (a:Artifact) REQUIRE a.id IS UNIQUE'
      );

      // Indexes for frequently queried properties
      await session.run(
        'CREATE INDEX entity_normalized_name IF NOT EXISTS FOR (e:Entity) ON (e.normalizedName)'
      );
      await session.run(
        'CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)'
      );
      await session.run(
        'CREATE INDEX entity_userId IF NOT EXISTS FOR (e:Entity) ON (e.userId)'
      );
      await session.run(
        'CREATE INDEX entity_document IF NOT EXISTS FOR (e:Entity) ON (e.documentId)'
      );
      await session.run(
        'CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name)'
      );
      await session.run(
        'CREATE INDEX entity_aliases IF NOT EXISTS FOR (e:Entity) ON (e.aliases)'
      );
      await session.run(
        'CREATE INDEX document_user IF NOT EXISTS FOR (d:Document) ON (d.userId)'
      );
      await session.run(
        'CREATE INDEX chunk_content_num IF NOT EXISTS FOR (c:Chunk) ON (c.contentNum)'
      );
      await session.run(
        'CREATE INDEX chunk_userId IF NOT EXISTS FOR (c:Chunk) ON (c.userId)'
      );
      await session.run(
        'CREATE INDEX concept_category IF NOT EXISTS FOR (c:Concept) ON (c.category)'
      );
      await session.run(
        'CREATE INDEX concept_userId IF NOT EXISTS FOR (c:Concept) ON (c.userId)'
      );
      await session.run(
        'CREATE INDEX identity_cluster_userId IF NOT EXISTS FOR (h:IdentityCluster) ON (h.userId)'
      );
      await session.run(
        'CREATE INDEX concept_document IF NOT EXISTS FOR (c:Concept) ON (c.documentId)'
      );
      await session.run(
        'CREATE INDEX concept_name IF NOT EXISTS FOR (c:Concept) ON (c.name)'
      );
      await session.run(
        'CREATE INDEX conversation_chat_userId IF NOT EXISTS FOR (c:Chat) ON (c.userId)'
      );
      await session.run(
        'CREATE INDEX conversation_message_userId IF NOT EXISTS FOR (m:Message) ON (m.userId)'
      );
      await session.run(
        'CREATE INDEX conversation_message_chatId IF NOT EXISTS FOR (m:Message) ON (m.chatId)'
      );
      await session.run(
        'CREATE INDEX conversation_artifact_userId IF NOT EXISTS FOR (a:Artifact) ON (a.userId)'
      );
      await session.run(
        'CREATE INDEX chunk_embedding_id IF NOT EXISTS FOR (c:Chunk) ON (c.embeddingId)'
      );

      // Compound (documentId, _sourceId) indexes back the share-copy MERGE
      // lookups in copyGraphData.ts (writeTargetNodes/InterNodeEdges/DocumentEdges).
      // _sourceId is transient (stripped at end-of-copy) so these indexes are
      // empty between shares — by design.
      await session.run(
        'CREATE INDEX entity_doc_sourceid IF NOT EXISTS FOR (e:Entity) ON (e.documentId, e._sourceId)'
      );
      await session.run(
        'CREATE INDEX concept_doc_sourceid IF NOT EXISTS FOR (c:Concept) ON (c.documentId, c._sourceId)'
      );
      await session.run(
        'CREATE INDEX chunk_doc_sourceid IF NOT EXISTS FOR (c:Chunk) ON (c.documentId, c._sourceId)'
      );

      // Full-text search indexes
      await session.run(
        'CREATE FULLTEXT INDEX entity_name_fulltext IF NOT EXISTS FOR (e:Entity) ON EACH [e.name]'
      );
      await session.run(
        'CREATE FULLTEXT INDEX concept_name_fulltext IF NOT EXISTS FOR (c:Concept) ON EACH [c.name]'
      );
      await session.run(
        'CREATE FULLTEXT INDEX chunk_content_fulltext IF NOT EXISTS FOR (c:Chunk) ON EACH [c.content]'
      );

      logger.info('[NEO4J-SOURCE] Constraints and indexes created successfully');
    } catch (error) {
      logger.error('[NEO4J-SOURCE] Error creating constraints/indexes:', error);
      // Don't throw - constraints might already exist
    } finally {
      await session.close();
    }
  }

  /**
   * Ensure driver is connected (auto-initialize if needed)
   */
  private async ensureConnected(): Promise<void> {
    if (!this.driver) {
      logger.info('[NEO4J-SOURCE] Driver not initialized, auto-connecting...');
      await this.connect();
    }
    logger.debug('[NEO4J-SOURCE] Driver connection verified');
  }

  /**
   * Get a new session for running queries
   */
  async getSession(): Promise<GraphSession> {
    await this.ensureConnected();
    if (!this.driver) {
      throw new Error('[NEO4J-SOURCE] Neo4j driver not initialized');
    }
    const session = this.driver.session();
    return new Neo4jSessionAdapter(session);
  }

  /**
   * Run a single query
   */
  async run(query: string, parameters?: Record<string, any>): Promise<GraphQueryResult> {
    logger.debug('[NEO4J-SOURCE] Getting session for query');
    const session = await this.getSession();
    try {
      logger.debug('[NEO4J-SOURCE] Running query with params:', {
        paramKeys: parameters ? Object.keys(parameters) : [],
      });
      const result = await session.run(query, parameters);
      logger.debug(`[NEO4J-SOURCE] Query completed, returned ${result.records.length} records`);
      return result;
    } catch (error) {
      logger.error('[NEO4J-SOURCE] Query error:', { query, parameters, error });
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Run multiple queries in a transaction
   */
  async runTransaction(queries: QueryBatch[]): Promise<GraphQueryResult[]> {
    const session = await this.getSession();
    const tx = session.beginTransaction();

    try {
      const results: GraphQueryResult[] = [];
      for (const { query, parameters } of queries) {
        const result = await tx.run(query, parameters);
        results.push(result);
      }
      await tx.commit();
      return results;
    } catch (error) {
      await tx.rollback();
      logger.error('[NEO4J-SOURCE] Transaction error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Close the driver connection
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      logger.info('[NEO4J-SOURCE] Driver disconnected');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.driver) {
        return false;
      }
      await this.driver.verifyConnectivity();
      return true;
    } catch (error) {
      logger.error('[NEO4J-SOURCE] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get the provider type
   */
  getProviderType(): string {
    return GraphDatabaseProviderType.NEO4J;
  }
}

/**
 * Helper function to create Neo4jSource from centralized config
 * Used by the client helper for simple singleton access
 */
export function createNeo4jSourceFromEnv(): Neo4jSource {
  const { getConfig } = require('@/server/config');
  const appConfig = getConfig();

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
