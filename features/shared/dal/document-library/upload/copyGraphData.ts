import { logger } from '@/server/logger';
import { getGraphDatabaseSource } from '@/features/graph-database';
import deleteGraphNodes from '@/features/graph-database/dal/deleteGraphNodes';
import db from '@/server/db';
import type { GraphDatabaseSource, QueryBatch } from '@/features/graph-database/sources/types';

type CopyGraphDataInput = {
  sourceDocumentId: string;
  targetDocumentId: string;
  targetUserId: string;
};

const EMBED_BATCH_SIZE = 50;

// Local copy of the safe-identifier guard that mirrors the pattern in
// `features/graph-database/services/jsonIngest/neo4jWriter.ts`. Duplicated
// rather than shared so the share path is self-contained.
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Cypher clause keywords and literals that pass SAFE_IDENTIFIER but fail at
// parse time when interpolated as a label or relationship type. Rejecting
// here surfaces a clean "Unsafe Neo4j label" error instead of an opaque
// Cypher syntax error from deep inside a transaction.
const CYPHER_RESERVED = new Set([
  'MATCH', 'RETURN', 'CREATE', 'WHERE', 'WITH', 'SET', 'REMOVE',
  'DELETE', 'OPTIONAL', 'MERGE', 'UNWIND', 'CALL', 'YIELD',
  'NULL', 'TRUE', 'FALSE', 'AND', 'OR', 'NOT', 'XOR',
]);

// Labels that have a backing (documentId, _sourceId) compound index in Neo4j
// (see features/graph-database/sources/neo4j.ts createConstraintsAndIndexes).
// Endpoint MATCHes in share-copy MUST use one of these so the planner can
// NodeIndexSeek instead of AllNodesScan. If a future ingest path writes
// share-copyable nodes with an additional label, add it here AND add the
// matching compound index.
const INDEXED_LABELS = ['Entity', 'Concept', 'Chunk'] as const;

type CanonicalLabelPick = { label: string; indexed: boolean };

function assertSafeLabel(label: string): void {
  if (!SAFE_IDENTIFIER.test(label) || CYPHER_RESERVED.has(label.toUpperCase())) {
    throw new Error(`Unsafe Neo4j label: ${label}`);
  }
}

function pickCanonicalLabel(labels: string[]): CanonicalLabelPick {
  if (labels.length === 0) {
    throw new Error('Source node has no labels');
  }
  for (const indexed of INDEXED_LABELS) {
    if (labels.includes(indexed)) {
      return { label: indexed, indexed: true };
    }
  }
  return { label: labels[0], indexed: false };
}

function assertSafeRelationshipType(type: string): void {
  if (!SAFE_IDENTIFIER.test(type) || CYPHER_RESERVED.has(type.toUpperCase())) {
    throw new Error(`Unsafe Neo4j relationship type: ${type}`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

type SourceNode = {
  sourceId: string;
  labels: string[];
  properties: Record<string, unknown>;
};

type SourceEdge = {
  sourceFromId: string;
  sourceToId: string;
  type: string;
  properties: Record<string, unknown>;
  aLabels: string[];
  bLabels: string[];
};

type DocumentEdge = {
  direction: 'OUT' | 'IN';
  sourceOtherId: string;
  type: string;
  properties: Record<string, unknown>;
  otherLabels: string[];
};

const RESERVED_NODE_PROPS = new Set<string>(['id', 'userId', 'documentId', '_sourceId']);
const RESERVED_EDGE_PROPS = new Set<string>(['userId', 'documentId']);

const TARGET_ALREADY_EXISTS_MESSAGE = 'target document already has graph data';

function isPrimitive(value: unknown): boolean {
  return (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || typeof value === 'bigint'
    || value === null
  );
}

function isPrimitiveArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
}

function sanitizePropertyValue(value: unknown): unknown | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isPrimitive(value)) {
    return value;
  }
  if (isPrimitiveArray(value)) {
    return value;
  }
  // Drop temporal types (DateTime, LocalDateTime, etc.) and other non-storable
  // structures — Neo4j won't accept them as property values when written back.
  // Recipients will regenerate timestamps via the copy logic's own datetime() calls.
  return undefined;
}

function stripReserved(props: Record<string, unknown>, reserved: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (reserved.has(key)) {
      continue;
    }
    const sanitized = sanitizePropertyValue(value);
    if (sanitized === undefined) {
      continue;
    }
    out[key] = sanitized;
  }
  return out;
}

async function readSourceDocumentExists(
  graphDb: GraphDatabaseSource,
  sourceDocumentId: string
): Promise<boolean> {
  const result = await graphDb.run(
    'MATCH (d:Document {id: $sourceDocumentId}) RETURN d LIMIT 1',
    { sourceDocumentId }
  );
  return result.records.length > 0;
}

async function readSourceDocumentProperties(
  graphDb: GraphDatabaseSource,
  sourceDocumentId: string
): Promise<Record<string, unknown>> {
  const result = await graphDb.run(
    'MATCH (d:Document {id: $sourceDocumentId}) RETURN properties(d) AS props',
    { sourceDocumentId }
  );
  if (result.records.length === 0) {
    return {};
  }
  const props = (result.records[0].get('props') as Record<string, unknown>) ?? {};
  // Strip copyComplete at the source so it never travels in memory and can't
  // leak into a re-shared doc's target via any future write site. The target's
  // markCopyComplete is the only path that should ever set it.
  const { copyComplete: _ignored, ...rest } = props;
  return rest;
}

async function readSourceNodes(
  graphDb: GraphDatabaseSource,
  sourceDocumentId: string
): Promise<SourceNode[]> {
  const result = await graphDb.run(
    `MATCH (n)
     WHERE n.documentId = $sourceDocumentId AND NOT n:Document
     RETURN n.id AS sourceId, labels(n) AS labels, properties(n) AS props`,
    { sourceDocumentId }
  );
  return result.records.map((record) => ({
    sourceId: record.get('sourceId') as string,
    labels: (record.get('labels') as string[]) ?? [],
    properties: (record.get('props') as Record<string, unknown>) ?? {},
  }));
}

async function readSourceInterNodeEdges(
  graphDb: GraphDatabaseSource,
  sourceDocumentId: string
): Promise<SourceEdge[]> {
  const result = await graphDb.run(
    `MATCH (a)-[r]->(b)
     WHERE a.documentId = $sourceDocumentId
       AND b.documentId = $sourceDocumentId
       AND NOT a:Document
       AND NOT b:Document
       AND type(r) <> 'IDENTITY'
       AND type(r) <> 'IN_CLUSTER'
     RETURN a.id AS sourceFromId, b.id AS sourceToId, type(r) AS relType, properties(r) AS props,
            labels(a) AS aLabels, labels(b) AS bLabels`,
    { sourceDocumentId }
  );
  return result.records.map((record) => ({
    sourceFromId: record.get('sourceFromId') as string,
    sourceToId: record.get('sourceToId') as string,
    type: record.get('relType') as string,
    properties: (record.get('props') as Record<string, unknown>) ?? {},
    aLabels: (record.get('aLabels') as string[]) ?? [],
    bLabels: (record.get('bLabels') as string[]) ?? [],
  }));
}

async function readSourceDocumentEdges(
  graphDb: GraphDatabaseSource,
  sourceDocumentId: string
): Promise<DocumentEdge[]> {
  const outResult = await graphDb.run(
    `MATCH (d:Document {id: $sourceDocumentId})-[r]->(n)
     WHERE n.documentId = $sourceDocumentId AND NOT n:Document
       AND type(r) <> 'IDENTITY'
     RETURN n.id AS otherId, type(r) AS relType, properties(r) AS props, labels(n) AS otherLabels`,
    { sourceDocumentId }
  );
  const inResult = await graphDb.run(
    `MATCH (n)-[r]->(d:Document {id: $sourceDocumentId})
     WHERE n.documentId = $sourceDocumentId AND NOT n:Document
       AND type(r) <> 'IDENTITY'
     RETURN n.id AS otherId, type(r) AS relType, properties(r) AS props, labels(n) AS otherLabels`,
    { sourceDocumentId }
  );
  const out: DocumentEdge[] = outResult.records.map((record) => ({
    direction: 'OUT' as const,
    sourceOtherId: record.get('otherId') as string,
    type: record.get('relType') as string,
    properties: (record.get('props') as Record<string, unknown>) ?? {},
    otherLabels: (record.get('otherLabels') as string[]) ?? [],
  }));
  const inn: DocumentEdge[] = inResult.records.map((record) => ({
    direction: 'IN' as const,
    sourceOtherId: record.get('otherId') as string,
    type: record.get('relType') as string,
    properties: (record.get('props') as Record<string, unknown>) ?? {},
    otherLabels: (record.get('otherLabels') as string[]) ?? [],
  }));
  return [...out, ...inn];
}

async function writeTargetDocument(
  graphDb: GraphDatabaseSource,
  sourceDocProps: Record<string, unknown>,
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  // Distinguish a real successful copy (preserve idempotency — don't double-write)
  // from a stale orphan left by a previous failed attempt (recover by cleaning up
  // and continuing). The `copyComplete` flag is set as the absolute last step of
  // a successful copy, so its presence is the definitive "this finished" signal.
  const existingResult = await graphDb.run(
    'MATCH (d:Document {id: $targetDocumentId}) RETURN d.copyComplete AS copyComplete LIMIT 1',
    { targetDocumentId }
  );
  if (existingResult.records.length > 0) {
    const copyComplete = existingResult.records[0].get('copyComplete') === true;
    if (copyComplete) {
      throw new Error(TARGET_ALREADY_EXISTS_MESSAGE);
    }
    logger.info('[GRAPH-SHARE-COPY] Detected stale orphan target, running cleanup before retry-write', {
      targetDocumentId,
    });
    try {
      await deleteGraphNodes(targetDocumentId);
    } catch (cleanupError) {
      // Re-throw: we can't proceed with CREATE while the orphan still exists
      // (would violate the Document.id uniqueness constraint anyway). BullMQ
      // will retry; next attempt's smart guard will re-detect and re-try
      // cleanup. Log here so SREs see the full failure context — the outer
      // catch only logs a sanitized message.
      logger.error('[GRAPH-SHARE-COPY] Pre-write cleanup of stale orphan failed; retry will re-attempt', {
        targetDocumentId,
        cleanupError,
      });
      throw cleanupError;
    }
  }
  // 'copyComplete' is also stripped at the read layer (readSourceDocumentProperties);
  // including it here is belt-and-suspenders against any future caller passing
  // sourceDocProps from a source that didn't go through that read.
  const cleanProps = stripReserved(sourceDocProps, new Set<string>(['id', 'userId', 'createdAt', 'copyComplete']));
  await graphDb.run(
    `CREATE (target:Document)
     SET target = $props
     SET target.id = $targetDocumentId
     SET target.userId = $targetUserId
     SET target.createdAt = datetime()`,
    {
      props: cleanProps,
      targetDocumentId,
      targetUserId,
    }
  );
}

async function writeTargetNodes(
  graphDb: GraphDatabaseSource,
  nodes: SourceNode[],
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  const byLabelKey = new Map<string, { labels: string[]; rows: Array<{ sourceId: string; props: Record<string, unknown> }> }>();
  for (const node of nodes) {
    if (node.labels.length === 0) {
      continue;
    }
    for (const label of node.labels) {
      assertSafeLabel(label);
    }
    const labelKey = node.labels.slice().sort().join(':');
    const cleanProps = stripReserved(node.properties, RESERVED_NODE_PROPS);
    const existing = byLabelKey.get(labelKey);
    const row = { sourceId: node.sourceId, props: cleanProps };
    if (existing) {
      existing.rows.push(row);
    } else {
      byLabelKey.set(labelKey, { labels: node.labels, rows: [row] });
    }
  }

  const queries: QueryBatch[] = [];
  for (const { labels, rows } of byLabelKey.values()) {
    const labelClause = labels.join(':');
    for (const batch of chunk(rows, EMBED_BATCH_SIZE)) {
      queries.push({
        query: `
          UNWIND $batch AS row
          MERGE (n:${labelClause} { documentId: $targetDocumentId, _sourceId: row.sourceId })
          ON CREATE SET
            n = row.props,
            n.id = randomUUID(),
            n.userId = $targetUserId,
            n.documentId = $targetDocumentId,
            n._sourceId = row.sourceId,
            n.createdAt = datetime()
        `,
        parameters: { batch, targetUserId, targetDocumentId },
      });
    }
  }

  if (queries.length === 0) {
    return;
  }
  await graphDb.runTransaction(queries);
}

async function writeTargetInterNodeEdges(
  graphDb: GraphDatabaseSource,
  edges: SourceEdge[],
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  type Bucket = {
    fromLabel: string;
    toLabel: string;
    type: string;
    rows: Array<{ sourceFromId: string; sourceToId: string; props: Record<string, unknown> }>;
  };
  const byKey = new Map<string, Bucket>();
  for (const edge of edges) {
    assertSafeRelationshipType(edge.type);
    // Validate ALL labels even though only the canonical one reaches Cypher —
    // defense-in-depth, mirrors writeTargetNodes. An auxiliary unsafe label
    // wouldn't reach Cypher anyway, but rejecting it here surfaces a corrupt
    // source graph as a clean throw rather than letting it ride.
    for (const label of edge.aLabels) {
      assertSafeLabel(label);
    }
    for (const label of edge.bLabels) {
      assertSafeLabel(label);
    }
    const from = pickCanonicalLabel(edge.aLabels);
    const to = pickCanonicalLabel(edge.bLabels);
    if (!from.indexed || !to.indexed) {
      throw new Error(
        `Share-copy: edge endpoint has no indexed label. type=${edge.type} from=${edge.aLabels.join(',')} to=${edge.bLabels.join(',')}; add the missing label to INDEXED_LABELS in copyGraphData.ts`
      );
    }
    const key = `${from.label}:${to.label}:${edge.type}`;
    const row = {
      sourceFromId: edge.sourceFromId,
      sourceToId: edge.sourceToId,
      props: stripReserved(edge.properties, RESERVED_EDGE_PROPS),
    };
    const existing = byKey.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      byKey.set(key, { fromLabel: from.label, toLabel: to.label, type: edge.type, rows: [row] });
    }
  }

  const queries: QueryBatch[] = [];
  for (const { fromLabel, toLabel, type, rows } of byKey.values()) {
    for (const batch of chunk(rows, EMBED_BATCH_SIZE)) {
      queries.push({
        query: `
          UNWIND $batch AS row
          MATCH (a:${fromLabel} {documentId: $targetDocumentId, _sourceId: row.sourceFromId})
          MATCH (b:${toLabel} {documentId: $targetDocumentId, _sourceId: row.sourceToId})
          MERGE (a)-[r:${type}]->(b)
          ON CREATE SET
            r = row.props,
            r.userId = $targetUserId,
            r.documentId = $targetDocumentId
        `,
        parameters: { batch, targetDocumentId, targetUserId },
      });
    }
  }

  await graphDb.runTransaction(queries);
}

async function writeTargetDocumentEdges(
  graphDb: GraphDatabaseSource,
  edges: DocumentEdge[],
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  type Bucket = {
    direction: 'OUT' | 'IN';
    type: string;
    otherLabel: string;
    rows: Array<{ sourceOtherId: string; props: Record<string, unknown> }>;
  };
  const byKey = new Map<string, Bucket>();
  for (const edge of edges) {
    assertSafeRelationshipType(edge.type);
    // Validate ALL labels even though only the canonical one reaches Cypher —
    // defense-in-depth, mirrors writeTargetNodes.
    for (const label of edge.otherLabels) {
      assertSafeLabel(label);
    }
    const other = pickCanonicalLabel(edge.otherLabels);
    if (!other.indexed) {
      throw new Error(
        `Share-copy: document edge endpoint has no indexed label. direction=${edge.direction} type=${edge.type} otherLabels=${edge.otherLabels.join(',')}; add the missing label to INDEXED_LABELS in copyGraphData.ts`
      );
    }
    const key = `${edge.direction}:${edge.type}:${other.label}`;
    const row = {
      sourceOtherId: edge.sourceOtherId,
      props: stripReserved(edge.properties, RESERVED_EDGE_PROPS),
    };
    const existing = byKey.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      byKey.set(key, { direction: edge.direction, type: edge.type, otherLabel: other.label, rows: [row] });
    }
  }

  const queries: QueryBatch[] = [];
  for (const { direction, type, otherLabel, rows } of byKey.values()) {
    const pattern = direction === 'OUT'
      ? `(d)-[r:${type}]->(n)`
      : `(n)-[r:${type}]->(d)`;
    for (const batch of chunk(rows, EMBED_BATCH_SIZE)) {
      queries.push({
        query: `
          UNWIND $batch AS row
          MATCH (d:Document {id: $targetDocumentId})
          MATCH (n:${otherLabel} {documentId: $targetDocumentId, _sourceId: row.sourceOtherId})
          MERGE ${pattern}
          ON CREATE SET
            r = row.props,
            r.userId = $targetUserId,
            r.documentId = $targetDocumentId
        `,
        parameters: { batch, targetDocumentId, targetUserId },
      });
    }
  }

  await graphDb.runTransaction(queries);
}

async function syncEntityIds(
  graphDb: GraphDatabaseSource,
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  const entityEmbeddings = await db.graphEntityEmbedding.findMany({
    where: { documentId: targetDocumentId },
    select: { id: true, entityName: true },
  });
  if (entityEmbeddings.length === 0) {
    return;
  }
  const queries: QueryBatch[] = entityEmbeddings.map((embedding) => ({
    query: `MATCH (e:Entity {documentId: $targetDocumentId, userId: $targetUserId, normalizedName: $normalizedName})
            SET e.id = $postgresId`,
    parameters: {
      targetDocumentId,
      targetUserId,
      normalizedName: embedding.entityName.toLowerCase().trim(),
      postgresId: embedding.id,
    },
  }));
  await graphDb.runTransaction(queries);
}

async function syncConceptIds(
  graphDb: GraphDatabaseSource,
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  const conceptEmbeddings = await db.graphConceptEmbedding.findMany({
    where: { documentId: targetDocumentId },
    select: { id: true, conceptName: true, category: true },
  });
  if (conceptEmbeddings.length === 0) {
    return;
  }
  const queries: QueryBatch[] = conceptEmbeddings.map((embedding) => ({
    query: `MATCH (c:Concept {documentId: $targetDocumentId, userId: $targetUserId, normalizedName: $normalizedName, category: $category})
            SET c.id = $postgresId`,
    parameters: {
      targetDocumentId,
      targetUserId,
      normalizedName: embedding.conceptName.toLowerCase().trim(),
      category: embedding.category ?? null,
      postgresId: embedding.id,
    },
  }));
  await graphDb.runTransaction(queries);
}

async function remapChunkEmbeddingIds(
  graphDb: GraphDatabaseSource,
  targetDocumentId: string,
  targetUserId: string
): Promise<void> {
  const targetEmbeddings = await db.embedding.findMany({
    where: { documentId: targetDocumentId },
    select: { id: true, contentNum: true },
  });
  if (targetEmbeddings.length === 0) {
    return;
  }
  const queries: QueryBatch[] = targetEmbeddings.map((embedding) => ({
    query: `MATCH (c:Chunk {documentId: $targetDocumentId, userId: $targetUserId, contentNum: $contentNum})
            SET c.embeddingId = $embeddingId`,
    parameters: {
      targetDocumentId,
      targetUserId,
      contentNum: embedding.contentNum,
      embeddingId: embedding.id,
    },
  }));
  await graphDb.runTransaction(queries);
}

async function stripSourceIdMarker(
  graphDb: GraphDatabaseSource,
  targetDocumentId: string
): Promise<void> {
  // One label-scoped REMOVE per indexed label so each query lands on a
  // per-label property index instead of degrading to AllNodesScan. The
  // indexed-label invariant for share-copyable nodes is enforced upstream
  // at the write site (pickCanonicalLabel + writer assertions), so this
  // set is exhaustive by construction.
  const queries: QueryBatch[] = INDEXED_LABELS.map((label) => ({
    query: `MATCH (n:${label} {documentId: $targetDocumentId}) REMOVE n._sourceId`,
    parameters: { targetDocumentId },
  }));
  await graphDb.runTransaction(queries);
}

// Final step of a successful copy. The flag is the definitive "I finished"
// signal that distinguishes a real complete copy from a stale orphan when the
// next attempt's idempotency guard runs. Must happen LAST so any earlier
// failure leaves the target without the flag.
//
// CONTRACT: copyComplete is only ever set here, only ever to literal `true`.
// The smart guard in writeTargetDocument uses strict equality (=== true) so
// any other value (string 'true', number 1, null, etc.) is treated as "not
// complete" and triggers stale-orphan cleanup. Never write any other value
// or shape from any other code path; doing so could either mask a stale
// orphan (false success) or destroy a real copy (false orphan).
async function markCopyComplete(
  graphDb: GraphDatabaseSource,
  targetDocumentId: string
): Promise<void> {
  await graphDb.run(
    'MATCH (d:Document {id: $targetDocumentId}) SET d.copyComplete = true',
    { targetDocumentId }
  );
}

// Best-effort rollback when the write phase fails after writeTargetDocument
// has already created the target :Document. Without this, the next retry hits
// the idempotency guard and the share is permanently broken for that target
// until someone manually DETACH-deletes the orphan. Reuses the canonical
// document-graph delete path so we get its IN TRANSACTIONS OF 1000 ROWS
// batching for free — important for large graphs.
async function cleanupPartialTarget(targetDocumentId: string): Promise<void> {
  try {
    await deleteGraphNodes(targetDocumentId);
  } catch (cleanupError) {
    logger.error('[GRAPH-SHARE-COPY] Cleanup failed after partial copy', {
      targetDocumentId,
      cleanupError,
    });
  }
}

/**
 * Copy Neo4j graph data from source document to target document.
 *
 * Topology / label / type-agnostic: copies every node where
 * `node.documentId = sourceDocumentId` (preserving labels) and every
 * relationship between two such nodes (preserving relationship type),
 * plus Document-anchored edges. IDENTITY and IN_CLUSTER edges are excluded
 * because they're derived state the recipient's own resolution flow can
 * re-derive. `:IdentityCluster` hub nodes need no explicit exclusion here —
 * `readSourceNodes` already requires `documentId = sourceDocumentId`, and a
 * hub carries no `documentId`.
 *
 * @returns true iff at least one non-Document node was written. false
 *   when the source Document is missing, or has no non-Document nodes.
 *   The graph-copy worker uses this signal to decide whether to flip
 *   `graph_metadata.status` to Completed (true) or delete the Building
 *   record entirely (false).
 */
export default async function copyGraphData(input: CopyGraphDataInput): Promise<boolean> {
  const { sourceDocumentId, targetDocumentId, targetUserId } = input;

  try {
    const graphDb = await getGraphDatabaseSource();

    const sourceExists = await readSourceDocumentExists(graphDb, sourceDocumentId);
    if (!sourceExists) {
      logger.info('[GRAPH-SHARE-COPY] Source document not present in Neo4j', {
        sourceDocumentId,
        targetDocumentId,
      });
      return false;
    }

    const sourceNodes = await readSourceNodes(graphDb, sourceDocumentId);
    if (sourceNodes.length === 0) {
      logger.info('[GRAPH-SHARE-COPY] Source document has no non-Document nodes', {
        sourceDocumentId,
        targetDocumentId,
      });
      return false;
    }

    const sourceDocProps = await readSourceDocumentProperties(graphDb, sourceDocumentId);
    const interNodeEdges = await readSourceInterNodeEdges(graphDb, sourceDocumentId);
    const documentEdges = await readSourceDocumentEdges(graphDb, sourceDocumentId);

    await writeTargetDocument(graphDb, sourceDocProps, targetDocumentId, targetUserId);

    try {
      await writeTargetNodes(graphDb, sourceNodes, targetDocumentId, targetUserId);
      await writeTargetInterNodeEdges(graphDb, interNodeEdges, targetDocumentId, targetUserId);
      await writeTargetDocumentEdges(graphDb, documentEdges, targetDocumentId, targetUserId);

      await remapChunkEmbeddingIds(graphDb, targetDocumentId, targetUserId);
      await syncEntityIds(graphDb, targetDocumentId, targetUserId);
      await syncConceptIds(graphDb, targetDocumentId, targetUserId);

      await stripSourceIdMarker(graphDb, targetDocumentId);
      await markCopyComplete(graphDb, targetDocumentId);
    } catch (writeError) {
      await cleanupPartialTarget(targetDocumentId);
      logger.info('[GRAPH-SHARE-COPY] Wrote partial target, rolled back via cleanup', {
        sourceDocumentId,
        targetDocumentId,
        error: writeError instanceof Error ? writeError.message : String(writeError),
      });
      throw writeError;
    }

    logger.info('[GRAPH-SHARE-COPY] Copy completed', {
      sourceDocumentId,
      targetDocumentId,
      targetUserId,
      nodesCopied: sourceNodes.length,
      interNodeEdgesCopied: interNodeEdges.length,
      documentEdgesCopied: documentEdges.length,
    });

    return true;
  } catch (error) {
    logger.error('Error copying graph data from source to target', {
      sourceDocumentId,
      targetDocumentId,
      error,
    });
    if (error instanceof Error && error.message === TARGET_ALREADY_EXISTS_MESSAGE) {
      throw error;
    }
    throw new Error('Error copying graph data');
  }
}
