import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

interface NodeTypeProperty {
  nodeType: string;
  properties: string[];
}

interface RelationshipSchema {
  startLabel: string;
  relType: string;
  endLabel: string;
}

interface _RelTypeProperties {
  relType: string;
  properties: string[];
}

// Properties to hide from LLM (internal/not useful for queries)
const HIDDEN_NODE_PROPERTIES = new Set(['needsEmbedding', 'embeddingId']);

// Relationship properties to hide (internal/resolution metadata)
const HIDDEN_REL_PROPERTIES = new Set([
  'id', 'policyVersion', 'resolvedAt', 'sharedDoc', 'sharedAliases',
  'cosineSimScore', 'phase', 'decidedBy', 'policy', 'positions', 'overlapTokens',
]);

// :IdentityCluster hubs and :IN_CLUSTER edges are internal structural plumbing
// (no documentId, no user-facing content). Conversation labels represent
// user-private topology, not document evidence. Never surface either to the LLM.
const HIDDEN_NODE_LABELS = new Set(['IdentityCluster', 'Chat', 'Message', 'Artifact']);

// A relationship is hidden when either endpoint is a hidden label. Every
// hidden-worthy relationship type (IN_CLUSTER, REFERENCED, IN_CHAT, PRODUCED)
// only ever connects to a hidden label, so hiding by endpoint keeps node and
// relationship hiding in lockstep — there is no second type list to drift.
const isHiddenRelationship = ({ startLabel, endLabel }: RelationshipSchema): boolean => (
  HIDDEN_NODE_LABELS.has(startLabel) || HIDDEN_NODE_LABELS.has(endLabel)
);

// Cache schema for 5 minutes to avoid repeated DB calls
let cachedSchema: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Dynamically fetch graph schema from Neo4j.
 * Includes node labels, properties, and relationship types.
 */
export async function getGraphSchema(): Promise<string> {
  // Return cached if still valid
  if (cachedSchema && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    logger.debug('[GRAPH-SCHEMA] Returning cached schema');
    return cachedSchema;
  }

  try {
    const graphDb = await getGraphDatabaseSource();

    // Fetch node properties
    const nodePropsResult = await graphDb.run(`
      CALL db.schema.nodeTypeProperties()
      YIELD nodeType, propertyName
      WITH nodeType, collect(propertyName) as properties
      RETURN nodeType, properties
      ORDER BY nodeType
    `);

    const nodeTypes: NodeTypeProperty[] = nodePropsResult.records
      .map((record) => ({
        nodeType: String(record.get('nodeType')).replace(/[:`]/g, ''),
        properties: (record.get('properties') as string[]).filter((p) => !HIDDEN_NODE_PROPERTIES.has(p)),
      }))
      .filter((nt) => !HIDDEN_NODE_LABELS.has(nt.nodeType));

    // Fetch relationship schema by sampling actual data (db.schema.visualization doesn't return labels reliably)
    const relSchemaResult = await graphDb.run(`
      MATCH (a)-[r]->(b)
      WHERE NOT a:IdentityCluster AND NOT b:IdentityCluster AND type(r) <> 'IN_CLUSTER'
      RETURN DISTINCT labels(a)[0] as startLabel, type(r) as relType, labels(b)[0] as endLabel
      ORDER BY startLabel, relType
    `);

    const relationships: RelationshipSchema[] = relSchemaResult.records
      .map((record) => ({
        startLabel: String(record.get('startLabel')),
        relType: String(record.get('relType')),
        endLabel: String(record.get('endLabel')),
      }))
      .filter((r) => !isHiddenRelationship(r));

    // Fetch relationship properties
    const relPropsResult = await graphDb.run(`
      CALL db.schema.relTypeProperties()
      YIELD relType, propertyName
      WITH relType, collect(propertyName) as properties
      RETURN relType, properties
      ORDER BY relType
    `);

    const relTypeProps: Map<string, string[]> = new Map();
    relPropsResult.records.forEach((record) => {
      const relType = String(record.get('relType')).replace(/[:`]/g, '');
      const props = (record.get('properties') as string[]).filter((p) => !HIDDEN_REL_PROPERTIES.has(p));
      if (props.length > 0) {
        relTypeProps.set(relType, props);
      }
    });

    // Build schema string
    const nodeSection = nodeTypes
      .map((nt) => `- ${nt.nodeType}: {${nt.properties.join(', ')}}`)
      .join('\n');

    const relSection = relationships
      .map((r) => {
        const props = relTypeProps.get(r.relType);
        const propsStr = props && props.length > 0 ? ` {${props.join(', ')}}` : '';
        return `- (${r.startLabel})-[:${r.relType}${propsStr}]->(${r.endLabel})`;
      })
      .join('\n');

    cachedSchema = `
Node Types:
${nodeSection}

Relationships:
${relSection}

Important:
- Always filter by documentId IN $documentIds for scope (and (n:Document AND n.id IN $documentIds) for Document nodes — they use 'id' instead of 'documentId')
- For type/category/relationType: match exact UPPERCASE values (e.g., e.type = 'PERSON')
- For name/description: use toLower() + CONTAINS for case-insensitive matching (e.g., toLower(e.name) CONTAINS 'acme')
- Relationship properties (e.g., r.context, r.sentiment) contain useful information - include them when relevant
`.trim();

    cacheTimestamp = Date.now();
    logger.info('[GRAPH-SCHEMA] Fetched dynamic schema', {
      nodeCount: nodeTypes.length,
      relCount: relationships.length,
      relTypesWithProps: relTypeProps.size,
    });

    return cachedSchema;
  } catch (error) {
    logger.error('[GRAPH-SCHEMA] Failed to fetch dynamic schema, using fallback', { error });
    return getFallbackSchema();
  }
}

/**
 * Fetch graph schema scoped to the requester's accessible documents.
 * Node types use the global schema (consistent across all data),
 * but relationships are scoped to only those present in the accessible docs.
 */
export async function getScopedGraphSchema(accessibleDocIds: AccessibleDocIds, documentIds: string[]): Promise<string> {
  try {
    const graphDb = await getGraphDatabaseSource();
    const accessibleArr = Array.from(accessibleDocIds);

    // Node type properties are consistent across the graph
    const nodePropsResult = await graphDb.run(`
      CALL db.schema.nodeTypeProperties()
      YIELD nodeType, propertyName
      WITH nodeType, collect(propertyName) as properties
      RETURN nodeType, properties
      ORDER BY nodeType
    `);

    const nodeTypes: NodeTypeProperty[] = nodePropsResult.records
      .map((record) => ({
        nodeType: String(record.get('nodeType')).replace(/[:`]/g, ''),
        properties: (record.get('properties') as string[]).filter((p) => !HIDDEN_NODE_PROPERTIES.has(p)),
      }))
      .filter((nt) => !HIDDEN_NODE_LABELS.has(nt.nodeType));

    // Scope relationships to the requester's accessible documents. The
    // a.documentId filter alone does NOT exclude hubs on the `b` side (a hub
    // has no documentId, but `a` here is the real member, whose documentId is
    // valid) — exclude :IdentityCluster/:IN_CLUSTER explicitly rather than
    // relying on that as incidental protection.
    const relSchemaResult = await graphDb.run(`
      MATCH (a)-[r]->(b)
      WHERE a.documentId IN $documentIds
        AND (a.documentId IN $accessibleDocIds OR (a:Document AND a.id IN $accessibleDocIds))
        AND NOT a:IdentityCluster AND NOT b:IdentityCluster AND type(r) <> 'IN_CLUSTER'
      RETURN DISTINCT labels(a)[0] AS startLabel, type(r) AS relType, labels(b)[0] AS endLabel
      ORDER BY startLabel, relType
    `, { documentIds, accessibleDocIds: accessibleArr });

    const relationships: RelationshipSchema[] = relSchemaResult.records
      .map((record) => ({
        startLabel: String(record.get('startLabel')),
        relType: String(record.get('relType')),
        endLabel: String(record.get('endLabel')),
      }))
      .filter((r) => !isHiddenRelationship(r));

    // Relationship properties are consistent per type — use global
    const relPropsResult = await graphDb.run(`
      CALL db.schema.relTypeProperties()
      YIELD relType, propertyName
      WITH relType, collect(propertyName) as properties
      RETURN relType, properties
      ORDER BY relType
    `);

    const relTypeProps: Map<string, string[]> = new Map();
    relPropsResult.records.forEach((record) => {
      const relType = String(record.get('relType')).replace(/[:`]/g, '');
      const props = (record.get('properties') as string[]).filter((p) => !HIDDEN_REL_PROPERTIES.has(p));
      if (props.length > 0) {
        relTypeProps.set(relType, props);
      }
    });

    // Fetch distinct values for key enumerable properties scoped to accessible docs
    const [entityTypesResult, conceptCategoriesResult, relationTypesResult] = await Promise.all([
      graphDb.run(`
        MATCH (e:Entity)
        WHERE e.documentId IN $documentIds
          AND e.documentId IN $accessibleDocIds
        RETURN DISTINCT e.type AS value, count(*) AS cnt
        ORDER BY cnt DESC
      `, { documentIds, accessibleDocIds: accessibleArr }),
      graphDb.run(`
        MATCH (c:Concept)
        WHERE c.documentId IN $documentIds
          AND c.documentId IN $accessibleDocIds
        RETURN DISTINCT c.category AS value, count(*) AS cnt
        ORDER BY cnt DESC
      `, { documentIds, accessibleDocIds: accessibleArr }),
      graphDb.run(`
        MATCH (a)-[r:RELATED]->(b)
        WHERE a.documentId IN $documentIds
          AND a.documentId IN $accessibleDocIds
        RETURN DISTINCT r.relationType AS value, count(*) AS cnt
        ORDER BY cnt DESC
      `, { documentIds, accessibleDocIds: accessibleArr }),
    ]);

    const formatValues = (records: typeof entityTypesResult.records) =>
      records
        .map((r) => {
          const val = r.get('value');
          const cnt = r.get('cnt');
          const count = typeof cnt?.toNumber === 'function' ? cnt.toNumber() : cnt;
          return val ? `${val} (${count})` : null;
        })
        .filter(Boolean)
        .join(', ');

    const entityTypes = formatValues(entityTypesResult.records);
    const conceptCategories = formatValues(conceptCategoriesResult.records);
    const relationTypes = formatValues(relationTypesResult.records);

    const nodeSection = nodeTypes
      .map((nt) => `- ${nt.nodeType}: {${nt.properties.join(', ')}}`)
      .join('\n');

    const relSection = relationships
      .map((r) => {
        const props = relTypeProps.get(r.relType);
        const propsStr = props && props.length > 0 ? ` {${props.join(', ')}}` : '';
        return `- (${r.startLabel})-[:${r.relType}${propsStr}]->(${r.endLabel})`;
      })
      .join('\n');

    const schema = `
Node Types:
${nodeSection}

Entity.type values: ${entityTypes || '(none)'}
Concept.category values: ${conceptCategories || '(none)'}
RELATED.relationType values: ${relationTypes || '(none)'}

Relationships:
${relSection}

Important:
- Always filter by documentId IN $documentIds for scope (and (n:Document AND n.id IN $documentIds) for Document nodes — they use 'id' instead of 'documentId')
- For type/category/relationType: match exact UPPERCASE values listed above (e.g., e.type = 'ORGANIZATION', not toLower(e.type) = 'organization')
- For name/description matching:
  - Long terms (4+ chars): use toLower() + CONTAINS (e.g., toLower(e.name) CONTAINS 'acme')
  - Short terms (≤3 chars like "ai", "hr"): use word-boundary regex: e.name =~ '(?i).*\\\\bai\\\\b.*'
- Relationship properties (e.g., r.context, r.sentiment) contain useful information - include them when relevant
`.trim();

    logger.info('[GRAPH-SCHEMA] Fetched scoped schema', {
      documentCount: documentIds.length,
      nodeCount: nodeTypes.length,
      relCount: relationships.length,
    });

    return schema;
  } catch (error) {
    logger.error('[GRAPH-SCHEMA] Failed to fetch scoped schema, using fallback', { error });
    return getFallbackSchema();
  }
}

/**
 * Fallback hardcoded schema if dynamic fetch fails.
 */
function getFallbackSchema(): string {
  return `
Node Types:
- Document: {id, userId, filename, uploadStatus, createdAt, totalChunks, totalTokens}
- Chunk: {id, content, summary, documentId, userId, contentNum, tokenCount, createdAt}
- Entity: {id, name, type, description, documentId, userId, normalizedName, aliases, mentionCount, firstSeenAt}
- Concept: {id, name, category, description, documentId, userId, normalizedName, mentionCount, firstSeenAt}

Relationships:
- (Document)-[:CONTAINS {position}]->(Chunk)
- (Chunk)-[:MENTIONS {context, count, confidence}]->(Entity)
- (Chunk)-[:DISCUSSES {context, sentiment, relevance}]->(Concept)
- (Chunk)-[:NEXT]->(Chunk)
- (Entity)-[:RELATED {context, description, relationType, confidence}]->(Entity)
- (Entity)-[:IDENTITY {confidence, rationale}]->(Entity)
- (Concept)-[:SIMILAR {confidence, rationale}]->(Concept)
- (Concept)-[:RELATED {context, description, relationType, confidence}]->(Concept)
- (Concept)-[:IDENTITY {confidence, rationale}]->(Concept)

Important:
- Always filter by documentId IN $documentIds for scope (and (n:Document AND n.id IN $documentIds) for Document nodes — they use 'id' instead of 'documentId')
- For type/category/relationType: match exact UPPERCASE values (e.g., e.type = 'PERSON')
- For name/description: use toLower() + CONTAINS for case-insensitive matching (e.g., toLower(e.name) CONTAINS 'acme')
- Relationship properties like r.context, r.sentiment contain useful information
`.trim();
}
