import type { Logger } from '@/server/logger';
import type {
  GraphDatabaseSource,
  QueryBatch,
} from '@/features/graph-database/sources/types';
import type {
  ValidRelation,
  EdgeSpec,
  InternalEntity,
} from '@/features/graph-database/services/jsonIngest/types';

export const EMBED_BATCH_SIZE = 50;

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const RESERVED_PROP_KEYS = new Set<string>([
  'id',
  'externalId',
  'name',
  'normalizedName',
  'type',
  'category',
  'description',
  'userId',
  'documentId',
  'mentionCount',
  'firstSeenAt',
  'needsEmbedding',
  'aliases',
  'createdAt',
  'updatedAt',
]);

function isPrimitive(value: unknown): boolean {
  return (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  );
}

function isArrayOfPrimitives(value: unknown): boolean {
  return Array.isArray(value) && value.every((v) => v === null || isPrimitive(v));
}

function flattenProperties(
  properties: Record<string, unknown> | undefined,
  logger: Logger,
  context: { kind: 'entity' | 'relation'; id: string }
): Record<string, unknown> {
  if (!properties) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (RESERVED_PROP_KEYS.has(key)) {
      logger.warn('[JSON-INGEST] Dropping property key that collides with reserved field', {
        key,
        ...context,
      });
      continue;
    }
    if (!SAFE_IDENTIFIER.test(key)) {
      logger.warn('[JSON-INGEST] Dropping property key with unsafe characters', {
        key,
        ...context,
      });
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (isPrimitive(value) || isArrayOfPrimitives(value)) {
      result[key] = value;
      continue;
    }
    try {
      result[key] = JSON.stringify(value);
    } catch {
      logger.warn('[JSON-INGEST] Dropping non-serializable property', { key, ...context });
    }
  }
  return result;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function assertSafeLabel(label: string): void {
  if (!SAFE_IDENTIFIER.test(label)) {
    throw new Error(`Unsafe Neo4j label: ${label}`);
  }
}

function assertSafeRelationshipType(type: string): void {
  if (!SAFE_IDENTIFIER.test(type)) {
    throw new Error(`Unsafe Neo4j relationship type: ${type}`);
  }
}

function buildNodeRows(
  entities: InternalEntity[],
  documentId: string,
  userId: string,
  logger: Logger
): Array<{ id: string; props: Record<string, unknown> }> {
  return entities.map((entity) => {
    const description = entity.description?.trim() ?? '';
    const normalizedName = entity.name.trim().toLowerCase();
    const flatProps = flattenProperties(entity.properties, logger, {
      kind: 'entity',
      id: entity.id,
    });
    const base: Record<string, unknown> = {
      id: entity.id,
      externalId: entity.externalId,
      name: entity.name,
      normalizedName,
      description,
      userId,
      documentId,
      mentionCount: 1,
      needsEmbedding: false,
      ...flatProps,
    };
    if (entity.label === 'Entity') {
      base.type = entity.type;
      base.aliases = [];
    } else {
      base.category = entity.type;
    }
    return { id: entity.id, props: base };
  });
}

export async function writeNodes(
  graphDb: GraphDatabaseSource,
  entities: InternalEntity[],
  documentId: string,
  userId: string,
  logger: Logger
): Promise<{ entityCount: number; conceptCount: number }> {
  const entityNodes = entities.filter((e) => e.label === 'Entity');
  const conceptNodes = entities.filter((e) => e.label === 'Concept');

  const queries: QueryBatch[] = [];

  for (const label of ['Entity', 'Concept'] as const) {
    const group = label === 'Entity' ? entityNodes : conceptNodes;
    if (group.length === 0) {
      continue;
    }
    assertSafeLabel(label);
    const rows = buildNodeRows(group, documentId, userId, logger);
    const batches = chunk(rows, EMBED_BATCH_SIZE);
    for (const batch of batches) {
      queries.push({
        query: `
          UNWIND $batch AS row
          MERGE (n:${label} { id: row.id })
          ON CREATE SET n += row.props, n.createdAt = datetime(), n.firstSeenAt = datetime()
          ON MATCH SET n += row.props, n.updatedAt = datetime()
        `,
        parameters: { batch },
      });
    }
  }

  if (queries.length > 0) {
    await graphDb.runTransaction(queries);
  }

  logger.info('[JSON-INGEST] Nodes written', {
    documentId,
    userId,
    entityCount: entityNodes.length,
    conceptCount: conceptNodes.length,
  });

  return {
    entityCount: entityNodes.length,
    conceptCount: conceptNodes.length,
  };
}

type EdgeInput = ValidRelation | EdgeSpec;

export async function writeEdges(
  graphDb: GraphDatabaseSource,
  relations: EdgeInput[],
  documentId: string,
  userId: string,
  logger: Logger
): Promise<{ edgeCount: number }> {
  if (relations.length === 0) {
    return { edgeCount: 0 };
  }

  const byType = new Map<string, EdgeInput[]>();
  for (const rel of relations) {
    const existing = byType.get(rel.type);
    if (existing) {
      existing.push(rel);
    } else {
      byType.set(rel.type, [rel]);
    }
  }

  const queries: QueryBatch[] = [];

  for (const [type, group] of byType.entries()) {
    assertSafeRelationshipType(type);
    const rows = group.map((rel) => {
      const flat = flattenProperties(
        (rel as { properties?: Record<string, unknown> }).properties,
        logger,
        { kind: 'relation', id: `${rel.source}->${rel.target}:${type}` }
      );
      return {
        source: rel.source,
        target: rel.target,
        props: {
          userId,
          documentId,
          ...flat,
        },
      };
    });
    const batches = chunk(rows, EMBED_BATCH_SIZE);
    for (const batch of batches) {
      queries.push({
        query: `
          UNWIND $batch AS row
          MATCH (s { id: row.source })
          MATCH (t { id: row.target })
          MERGE (s)-[r:${type}]->(t)
          ON CREATE SET r += row.props, r.createdAt = datetime()
          ON MATCH SET r += row.props, r.updatedAt = datetime()
        `,
        parameters: { batch },
      });
    }
  }

  await graphDb.runTransaction(queries);

  logger.info('[JSON-INGEST] Edges written', {
    documentId,
    userId,
    edgeCount: relations.length,
    typeCount: byType.size,
  });

  return { edgeCount: relations.length };
}

export async function writeDocumentMentions(
  graphDb: GraphDatabaseSource,
  documentId: string,
  userId: string,
  entityIds: string[],
  conceptIds: string[],
  logger: Logger
): Promise<void> {
  if (entityIds.length === 0 && conceptIds.length === 0) {
    return;
  }

  const queries: QueryBatch[] = [];

  const entityRows = entityIds.map((entityId) => ({ documentId, entityId }));
  for (const batch of chunk(entityRows, EMBED_BATCH_SIZE)) {
    queries.push({
      query: `
        UNWIND $batch AS row
        MATCH (d:Document { id: row.documentId })
        MATCH (e:Entity { id: row.entityId })
        MERGE (d)-[r:MENTIONS]->(e)
        ON CREATE SET r.createdAt = datetime(), r.userId = $userId
      `,
      parameters: { batch, userId },
    });
  }

  const conceptRows = conceptIds.map((conceptId) => ({ documentId, conceptId }));
  for (const batch of chunk(conceptRows, EMBED_BATCH_SIZE)) {
    queries.push({
      query: `
        UNWIND $batch AS row
        MATCH (d:Document { id: row.documentId })
        MATCH (c:Concept { id: row.conceptId })
        MERGE (d)-[r:DISCUSSES]->(c)
        ON CREATE SET r.createdAt = datetime(), r.userId = $userId
      `,
      parameters: { batch, userId },
    });
  }

  if (queries.length === 0) {
    return;
  }

  await graphDb.runTransaction(queries);

  logger.info('[JSON-INGEST] Document mentions written', {
    documentId,
    userId,
    entityCount: entityIds.length,
    conceptCount: conceptIds.length,
  });
}
