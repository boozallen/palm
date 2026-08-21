import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { GraphDatabaseSource } from '@/features/graph-database/sources/types';

export type SeededIds = {
  userA: string;
  userB: string;
  userC: string;
  uploadProviderId: string;
  docA1: string;
  docA2: string;
  docA3: string;
  docC1: string;
  docA1Entities: string[];
  docA1Concepts: string[];
  docA1Chunks: string[];
  docA2Entities: string[];
  docA3Entities: string[];
  docA3Concepts: string[];
  docC1Entity: string;
  multiLabelEntityId: string;
  // Populated only when seed is called with admin: { includeAdmin: true }
  adminUserId?: string;
  docAdmin?: string;
  docAdminEntities?: string[];
  docAdminConcepts?: string[];
  docAdminChunks?: string[];
  financeGroupId?: string;
  marketingGroupId?: string;
  // Populated only when seed is called with admin: { includeWorkflow: true }
  workflowId?: string;
};

const ZERO_VECTOR = `[${new Array(1536).fill(0).join(',')}]`;

function toHex(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += input.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return out;
}

function makeId(suffix: string, runSuffix: string): string {
  // Encode arbitrary input characters to hex so we always get a valid UUID.
  const padded = (toHex(suffix) + runSuffix).padEnd(32, '0').slice(0, 32);
  return [
    padded.slice(0, 8),
    padded.slice(8, 12),
    '4' + padded.slice(13, 16),
    '8' + padded.slice(17, 20),
    padded.slice(20, 32),
  ].join('-');
}

export type SeedShareTestGraphOptions = {
  /**
   * Run-suffix injected into all seeded UUIDs so concurrent test runs don't collide.
   * Default: a random 8-char hex string.
   */
  runSuffix?: string;
  /**
   * Opt-in extensions for admin-share-graph-access tests.
   * Existing callers (copyGraphData.integration.test.ts) do not pass this and get the original seed shape.
   */
  admin?: {
    /**
     * Seed an admin user, an admin-created document (D_admin) with embeddings + graph,
     * a "Finance" group with User A as member (granting access to D_admin), and a
     * "Marketing" group with User B as member (no D_admin access). D_admin's graph
     * includes an entity with type 'ADMIN_ONLY_TYPE' so schema-isolation assertions
     * can target a value not present in any other doc's graph.
     */
    includeAdmin?: boolean;
    /**
     * Additionally seed a Workflow row owned by User B whose definition references
     * docA1 (a doc User B does NOT have access to). Used by Action 8 to prove that
     * processDocuments filters inaccessible docs internally without throwing.
     */
    includeWorkflow?: boolean;
  };
};

export async function seedShareTestGraph(
  graphDb: GraphDatabaseSource,
  prisma: PrismaClient,
  options: SeedShareTestGraphOptions = {}
): Promise<SeededIds> {
  const runSuffix = options.runSuffix ?? crypto.randomBytes(4).toString('hex');

  const ids: SeededIds = {
    userA: makeId('aaa1', runSuffix),
    userB: makeId('bbb2', runSuffix),
    userC: makeId('ccc3', runSuffix),
    uploadProviderId: makeId('dddd', runSuffix),
    docA1: makeId('d0a1', runSuffix),
    docA2: makeId('d0a2', runSuffix),
    docA3: makeId('d0a3', runSuffix),
    docC1: makeId('d0c1', runSuffix),
    docA1Entities: [
      makeId('e0a11', runSuffix),
      makeId('e0a12', runSuffix),
      makeId('e0a13', runSuffix),
      makeId('e0a14', runSuffix),
    ],
    docA1Concepts: [
      makeId('c0a11', runSuffix),
      makeId('c0a12', runSuffix),
    ],
    docA1Chunks: [
      makeId('k0a11', runSuffix),
      makeId('k0a12', runSuffix),
      makeId('k0a13', runSuffix),
    ],
    docA2Entities: [
      makeId('e0a21', runSuffix),
      makeId('e0a22', runSuffix),
    ],
    docA3Entities: [
      makeId('e0a31', runSuffix),
      makeId('e0a32', runSuffix),
      makeId('e0a33', runSuffix),
      makeId('e0a34', runSuffix),
      makeId('e0a35', runSuffix),
    ],
    docA3Concepts: [
      makeId('c0a31', runSuffix),
      makeId('c0a32', runSuffix),
      makeId('c0a33', runSuffix),
    ],
    docC1Entity: makeId('e0c11', runSuffix),
    multiLabelEntityId: makeId('emul1', runSuffix),
  };

  if (options.admin?.includeAdmin) {
    ids.adminUserId = makeId('admn1', runSuffix);
    ids.docAdmin = makeId('d0adm', runSuffix);
    ids.docAdminEntities = [
      makeId('e0adm1', runSuffix),
      makeId('e0adm2', runSuffix),
      makeId('e0adm3', runSuffix),
    ];
    ids.docAdminConcepts = [makeId('c0adm1', runSuffix)];
    ids.docAdminChunks = [
      makeId('k0adm1', runSuffix),
      makeId('k0adm2', runSuffix),
    ];
    ids.financeGroupId = makeId('gfin1', runSuffix);
    ids.marketingGroupId = makeId('gmkt1', runSuffix);
  }
  if (options.admin?.includeWorkflow) {
    ids.workflowId = makeId('wf001', runSuffix);
  }

  await teardownShareTestGraph(graphDb, prisma, ids);

  // ============================================================
  // Postgres seed
  // ============================================================
  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" (id, name, role, "createdAt", "updatedAt") VALUES
      ('${ids.userA}'::uuid, 'User A', 'User', NOW(), NOW()),
      ('${ids.userB}'::uuid, 'User B', 'User', NOW(), NOW()),
      ('${ids.userC}'::uuid, 'User C', 'User', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "DocumentUploadProvider" (id, label, type, config, "createdAt", "updatedAt") VALUES
      ('${ids.uploadProviderId}'::uuid, 'test-share-provider', 0, '{}'::jsonb, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Document" (id, "userId", filename, "uploadStatus", "createdAt", "documentUploadProviderId") VALUES
      ('${ids.docA1}'::uuid, '${ids.userA}'::uuid, 'docA1.pdf', 'Completed', NOW(), '${ids.uploadProviderId}'::uuid),
      ('${ids.docA2}'::uuid, '${ids.userA}'::uuid, 'docA2.pdf', 'Completed', NOW(), '${ids.uploadProviderId}'::uuid),
      ('${ids.docA3}'::uuid, '${ids.userA}'::uuid, 'docA3.json', 'Completed', NOW(), '${ids.uploadProviderId}'::uuid),
      ('${ids.docC1}'::uuid, '${ids.userC}'::uuid, 'docC1.pdf', 'Completed', NOW(), '${ids.uploadProviderId}'::uuid)
    ON CONFLICT (id) DO NOTHING
  `);

  // Embeddings for docA1 (3 chunks)
  for (let i = 0; i < 3; i++) {
    const embId = makeId(`emb1${i}`, runSuffix);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Embedding" (id, embedding, content, "contentNum", "documentId", "createdAt") VALUES
        ('${embId}'::uuid, '${ZERO_VECTOR}'::vector, 'chunk content ${i}', ${i}, '${ids.docA1}'::uuid, NOW())
    `);
  }

  // Graph entity embeddings for docA1 (4 entities)
  const docA1EntityNames = ['Acme Corp', 'Bob Smith', 'NextGen Tech', 'Washington DC'];
  for (let i = 0; i < ids.docA1Entities.length; i++) {
    const name = docA1EntityNames[i];
    await prisma.$executeRawUnsafe(`
      INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt") VALUES
        ('${ids.docA1Entities[i]}'::uuid, '${name}', '${ZERO_VECTOR}'::vector, 'desc-${i}', ARRAY[]::text[], '${ids.docA1}'::uuid, '${ids.userA}'::uuid, NOW())
    `);
  }

  // Graph concept embeddings for docA1 (2 concepts)
  const docA1ConceptNames = [
    { name: 'Cloud Architecture', category: 'TECHNICAL' },
    { name: 'Revenue Growth', category: 'BUSINESS' },
  ];
  for (let i = 0; i < ids.docA1Concepts.length; i++) {
    const c = docA1ConceptNames[i];
    await prisma.$executeRawUnsafe(`
      INSERT INTO graph_concept_embeddings (id, "conceptName", embedding, description, category, "documentId", "userId", "createdAt") VALUES
        ('${ids.docA1Concepts[i]}'::uuid, '${c.name}', '${ZERO_VECTOR}'::vector, 'desc-${i}', '${c.category}', '${ids.docA1}'::uuid, '${ids.userA}'::uuid, NOW())
    `);
  }

  // docA2 entities (PDF, NOT shared)
  const docA2EntityNames = ['Other Corp', 'Alice Doe'];
  for (let i = 0; i < ids.docA2Entities.length; i++) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt") VALUES
        ('${ids.docA2Entities[i]}'::uuid, '${docA2EntityNames[i]}', '${ZERO_VECTOR}'::vector, 'other-desc', ARRAY[]::text[], '${ids.docA2}'::uuid, '${ids.userA}'::uuid, NOW())
    `);
  }

  // docA3 entities (palm-graph)
  const docA3EntityNames = ['Defense Health Agency', 'Booz Allen', 'AWS', 'GovCloud', 'Department of Defense'];
  for (let i = 0; i < ids.docA3Entities.length; i++) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt") VALUES
        ('${ids.docA3Entities[i]}'::uuid, '${docA3EntityNames[i]}', '${ZERO_VECTOR}'::vector, 'desc-pg-${i}', ARRAY[]::text[], '${ids.docA3}'::uuid, '${ids.userA}'::uuid, NOW())
    `);
  }

  const docA3ConceptNames = [
    { name: 'Healthcare Modernization', category: 'STRATEGIC' },
    { name: 'Cyber Resilience', category: 'TECHNICAL' },
    { name: 'Mission Capability', category: 'OPERATIONAL' },
  ];
  for (let i = 0; i < ids.docA3Concepts.length; i++) {
    const c = docA3ConceptNames[i];
    await prisma.$executeRawUnsafe(`
      INSERT INTO graph_concept_embeddings (id, "conceptName", embedding, description, category, "documentId", "userId", "createdAt") VALUES
        ('${ids.docA3Concepts[i]}'::uuid, '${c.name}', '${ZERO_VECTOR}'::vector, 'desc-pg-${i}', '${c.category}', '${ids.docA3}'::uuid, '${ids.userA}'::uuid, NOW())
    `);
  }

  // docC1 entity (isolation sentinel)
  await prisma.$executeRawUnsafe(`
    INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt") VALUES
      ('${ids.docC1Entity}'::uuid, 'Sentinel Entity', '${ZERO_VECTOR}'::vector, 'sentinel', ARRAY[]::text[], '${ids.docC1}'::uuid, '${ids.userC}'::uuid, NOW())
  `);

  // ============================================================
  // Admin-share Postgres seed (optional)
  // ============================================================
  if (
    options.admin?.includeAdmin
    && ids.adminUserId
    && ids.docAdmin
    && ids.docAdminEntities
    && ids.docAdminConcepts
    && ids.financeGroupId
    && ids.marketingGroupId
  ) {
    // Admin user
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, name, role, "createdAt", "updatedAt") VALUES
        ('${ids.adminUserId}'::uuid, 'Test Admin', 'Admin', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Admin-created Document
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Document" (id, "userId", filename, "uploadStatus", "createdAt", "documentUploadProviderId", "adminCreated") VALUES
        ('${ids.docAdmin}'::uuid, '${ids.adminUserId}'::uuid, 'docAdmin.pdf', 'Completed', NOW(), '${ids.uploadProviderId}'::uuid, true)
      ON CONFLICT (id) DO NOTHING
    `);

    // D_admin embeddings (2 chunks)
    for (let i = 0; i < 2; i++) {
      const embId = makeId(`embAd${i}`, runSuffix);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Embedding" (id, embedding, content, "contentNum", "documentId", "createdAt") VALUES
          ('${embId}'::uuid, '${ZERO_VECTOR}'::vector, 'admin doc chunk ${i}', ${i}, '${ids.docAdmin}'::uuid, NOW())
      `);
    }

    // D_admin entity embeddings (3 entities — one will be ADMIN_ONLY_TYPE in Neo4j)
    const docAdminEntityNames = ['Quarterly Report', 'Finance Director', 'Audit Procedure'];
    for (let i = 0; i < ids.docAdminEntities.length; i++) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO graph_entity_embeddings (id, "entityName", embedding, description, aliases, "documentId", "userId", "createdAt") VALUES
          ('${ids.docAdminEntities[i]}'::uuid, '${docAdminEntityNames[i]}', '${ZERO_VECTOR}'::vector, 'admin-desc-${i}', ARRAY[]::text[], '${ids.docAdmin}'::uuid, '${ids.adminUserId}'::uuid, NOW())
      `);
    }

    // D_admin concept embedding
    await prisma.$executeRawUnsafe(`
      INSERT INTO graph_concept_embeddings (id, "conceptName", embedding, description, category, "documentId", "userId", "createdAt") VALUES
        ('${ids.docAdminConcepts[0]}'::uuid, 'Regulatory Compliance', '${ZERO_VECTOR}'::vector, 'admin-concept', 'COMPLIANCE', '${ids.docAdmin}'::uuid, '${ids.adminUserId}'::uuid, NOW())
    `);

    // User groups: Finance + Marketing
    await prisma.$executeRawUnsafe(`
      INSERT INTO "UserGroup" (id, label, "createdAt", "updatedAt") VALUES
        ('${ids.financeGroupId}'::uuid, 'Finance-${runSuffix}', NOW(), NOW()),
        ('${ids.marketingGroupId}'::uuid, 'Marketing-${runSuffix}', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Memberships: A in Finance, B in Marketing
    await prisma.$executeRawUnsafe(`
      INSERT INTO "UserGroupMembership" ("userGroupId", "userId", role) VALUES
        ('${ids.financeGroupId}'::uuid, '${ids.userA}'::uuid, 'User'),
        ('${ids.marketingGroupId}'::uuid, '${ids.userB}'::uuid, 'User')
      ON CONFLICT ("userGroupId", "userId") DO NOTHING
    `);

    // D_admin assigned to Finance group
    await prisma.$executeRawUnsafe(`
      INSERT INTO admin_document_groups ("documentId", "userGroupId", "createdAt") VALUES
        ('${ids.docAdmin}'::uuid, '${ids.financeGroupId}'::uuid, NOW())
      ON CONFLICT ("documentId", "userGroupId") DO NOTHING
    `);

    // accessUsers (implicit M:M relation table is "_AdminDocumentAccess"; A = Document.id, B = User.id)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_AdminDocumentAccess" ("A", "B") VALUES
        ('${ids.docAdmin}'::uuid, '${ids.userA}'::uuid)
      ON CONFLICT DO NOTHING
    `);
  }

  if (options.admin?.includeWorkflow && ids.workflowId) {
    // Workflow owned by User B whose definition references docA1 (B has no access to docA1).
    // Definition shape is the minimum needed by Action 8 — a single PromptPrimitive node
    // whose config carries documentIds. The exact runtime schema doesn't matter for the
    // intersection test; processDocuments only reads the documentIds field.
    const definition = JSON.stringify({
      nodes: [
        {
          id: 'prompt-1',
          type: 'PromptPrimitive',
          config: {
            documentIds: [ids.docA1],
            message: 'Summarize this document',
            useGraph: false,
          },
        },
      ],
      edges: [],
    }).replace(/'/g, '\'\'');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Workflow" (id, name, definition, "createdBy", "createdAt", "updatedAt") VALUES
        ('${ids.workflowId}'::uuid, 'Test Workflow', '${definition}'::jsonb, '${ids.userB}'::uuid, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }

  // ============================================================
  // Neo4j seed
  // ============================================================
  // docA1: PDF topology
  await graphDb.run(
    `CREATE (d:Document {
       id: $docId, userId: $userId, filename: 'docA1.pdf', name: 'docA1', uploadStatus: 'Completed',
       totalChunks: 3, totalTokens: 0, createdAt: datetime()
     })`,
    { docId: ids.docA1, userId: ids.userA }
  );
  for (let i = 0; i < 3; i++) {
    await graphDb.run(
      `MATCH (d:Document {id: $docId})
       CREATE (c:Chunk {
         id: $chunkId, content: 'chunk ' + toString($i), contentNum: $i, tokenCount: 100,
         createdAt: datetime(), embeddingId: $embeddingId, summary: '',
         documentId: $docId, userId: $userId, startPosition: 0, endPosition: 100
       })
       CREATE (d)-[:CONTAINS {position: $i}]->(c)`,
      {
        docId: ids.docA1,
        userId: ids.userA,
        chunkId: ids.docA1Chunks[i],
        i,
        embeddingId: makeId(`emb1${i}`, runSuffix),
      }
    );
    if (i > 0) {
      await graphDb.run(
        `MATCH (a:Chunk {id: $a}), (b:Chunk {id: $b})
         CREATE (a)-[:NEXT {overlapTokens: 50}]->(b)`,
        { a: ids.docA1Chunks[i - 1], b: ids.docA1Chunks[i] }
      );
    }
  }
  // docA1 entities (varied types)
  const docA1EntityTypes = ['ORGANIZATION', 'PERSON', 'TECHNOLOGY', 'LOCATION'];
  for (let i = 0; i < ids.docA1Entities.length; i++) {
    await graphDb.run(
      `CREATE (e:Entity {
         id: $entityId, name: $name, normalizedName: $normalizedName,
         type: $type, description: $description, aliases: $aliases,
         mentionCount: $mentionCount, documentId: $docId, userId: $userId,
         needsEmbedding: false, firstSeenAt: datetime()
       })`,
      {
        entityId: ids.docA1Entities[i],
        name: docA1EntityNames[i],
        normalizedName: docA1EntityNames[i].toLowerCase(),
        type: docA1EntityTypes[i],
        description: `desc-${i}`,
        aliases: i === 0 ? ['Acme', 'ACME Inc'] : [],
        mentionCount: i + 1,
        docId: ids.docA1,
        userId: ids.userA,
      }
    );
  }
  // docA1 concepts
  for (let i = 0; i < ids.docA1Concepts.length; i++) {
    const c = docA1ConceptNames[i];
    await graphDb.run(
      `CREATE (c:Concept {
         id: $id, name: $name, normalizedName: $normalizedName, category: $category,
         description: $description, mentionCount: 1, documentId: $docId, userId: $userId,
         needsEmbedding: false, firstSeenAt: datetime()
       })`,
      {
        id: ids.docA1Concepts[i],
        name: c.name,
        normalizedName: c.name.toLowerCase(),
        category: c.category,
        description: `concept-desc-${i}`,
        docId: ids.docA1,
        userId: ids.userA,
      }
    );
  }
  // docA1 multi-label node (Entity + Person)
  await graphDb.run(
    `CREATE (e:Entity:Person {
       id: $id, name: 'Carol Multi', normalizedName: 'carol multi',
       type: 'PERSON', description: 'multi-label test', aliases: [],
       mentionCount: 1, documentId: $docId, userId: $userId,
       needsEmbedding: false, firstSeenAt: datetime()
     })`,
    { id: ids.multiLabelEntityId, docId: ids.docA1, userId: ids.userA }
  );

  // docA1 MENTIONS (chunk -> entity): 6 total (each chunk mentions 2 entities)
  const mentionsPlan = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 2],
    [2, 3],
  ];
  for (const [chunkIdx, entityIdx] of mentionsPlan) {
    await graphDb.run(
      `MATCH (c:Chunk {id: $chunkId}), (e:Entity {id: $entityId})
       CREATE (c)-[:MENTIONS {count: 1, positions: [0], confidence: 0.9, context: 'context', userId: $userId, documentId: $docId}]->(e)`,
      {
        chunkId: ids.docA1Chunks[chunkIdx],
        entityId: ids.docA1Entities[entityIdx],
        userId: ids.userA,
        docId: ids.docA1,
      }
    );
  }

  // docA1 DISCUSSES (chunk -> concept): 3 total
  for (let i = 0; i < 3; i++) {
    const conceptIdx = i % 2;
    await graphDb.run(
      `MATCH (c:Chunk {id: $chunkId}), (cc:Concept {id: $conceptId})
       CREATE (c)-[:DISCUSSES {relevance: 0.8, sentiment: 'neutral', context: 'ctx', userId: $userId, documentId: $docId}]->(cc)`,
      {
        chunkId: ids.docA1Chunks[i],
        conceptId: ids.docA1Concepts[conceptIdx],
        userId: ids.userA,
        docId: ids.docA1,
      }
    );
  }

  // docA1 RELATED edges between entities/concepts: 5 total
  const relatedPlan: Array<[string, string, string]> = [
    [ids.docA1Entities[0], ids.docA1Entities[1], 'WORKS_AT'],
    [ids.docA1Entities[0], ids.docA1Entities[2], 'USES'],
    [ids.docA1Entities[2], ids.docA1Entities[3], 'LOCATED_IN'],
    [ids.docA1Entities[1], ids.docA1Concepts[0], 'EXPERT_IN'],
    [ids.docA1Concepts[0], ids.docA1Concepts[1], 'DRIVES'],
  ];
  for (const [from, to, relationType] of relatedPlan) {
    await graphDb.run(
      `MATCH (a {id: $from}), (b {id: $to})
       CREATE (a)-[:RELATED {id: randomUUID(), relationType: $relationType, phase: 'extraction', description: 'rel', context: 'ctx', confidence: 0.9, decidedBy: 'rule', userId: $userId, documentId: $docId}]->(b)`,
      { from, to, relationType, userId: ids.userA, docId: ids.docA1 }
    );
  }

  // docA1 custom edge type (WORKS_FOR) — Entity -> Entity
  await graphDb.run(
    `MATCH (a:Entity {id: $from}), (b:Entity {id: $to})
     CREATE (a)-[:WORKS_FOR {confidence: 0.9, userId: $userId, documentId: $docId}]->(b)`,
    {
      from: ids.docA1Entities[1],
      to: ids.docA1Entities[0],
      userId: ids.userA,
      docId: ids.docA1,
    }
  );

  // docA1 intra-document IDENTITY edge
  await graphDb.run(
    `MATCH (a:Entity {id: $from}), (b:Entity {id: $to})
     CREATE (a)-[:IDENTITY {id: randomUUID(), confidence: 0.95, decidedBy: 'llm', userId: $userId, documentId: $docId}]->(b)`,
    {
      from: ids.docA1Entities[0],
      to: ids.docA1Entities[2],
      userId: ids.userA,
      docId: ids.docA1,
    }
  );

  // ============================================================
  // docA2: PDF topology, NOT shared
  // ============================================================
  await graphDb.run(
    `CREATE (d:Document {
       id: $docId, userId: $userId, filename: 'docA2.pdf', uploadStatus: 'Completed',
       totalChunks: 1, totalTokens: 0, createdAt: datetime()
     })`,
    { docId: ids.docA2, userId: ids.userA }
  );
  const docA2ChunkId = makeId('k0a21', runSuffix);
  await graphDb.run(
    `MATCH (d:Document {id: $docId})
     CREATE (c:Chunk {
       id: $chunkId, content: 'doc a2 chunk', contentNum: 0, tokenCount: 100,
       createdAt: datetime(), embeddingId: $embeddingId, summary: '',
       documentId: $docId, userId: $userId
     })
     CREATE (d)-[:CONTAINS {position: 0}]->(c)`,
    { docId: ids.docA2, userId: ids.userA, chunkId: docA2ChunkId, embeddingId: makeId('emb2', runSuffix) }
  );
  for (let i = 0; i < ids.docA2Entities.length; i++) {
    await graphDb.run(
      `CREATE (e:Entity {
         id: $entityId, name: $name, normalizedName: $normalizedName,
         type: 'ORGANIZATION', description: 'doc-a2', aliases: [],
         mentionCount: 1, documentId: $docId, userId: $userId,
         needsEmbedding: false, firstSeenAt: datetime()
       })`,
      {
        entityId: ids.docA2Entities[i],
        name: docA2EntityNames[i],
        normalizedName: docA2EntityNames[i].toLowerCase(),
        docId: ids.docA2,
        userId: ids.userA,
      }
    );
  }
  // Cross-doc IDENTITY: docA2.entity[0] <-> docA1.entity[0]
  await graphDb.run(
    `MATCH (a:Entity {id: $from}), (b:Entity {id: $to})
     CREATE (a)-[:IDENTITY {id: randomUUID(), confidence: 0.85, decidedBy: 'llm', userId: $userId, documentId: $docFrom}]->(b)`,
    {
      from: ids.docA2Entities[0],
      to: ids.docA1Entities[0],
      userId: ids.userA,
      docFrom: ids.docA2,
    }
  );

  // ============================================================
  // docA3: palm-graph topology
  // ============================================================
  await graphDb.run(
    `CREATE (d:Document {
       id: $docId, userId: $userId, filename: 'docA3.json', uploadStatus: 'Completed',
       totalChunks: 0, totalTokens: 0, createdAt: datetime()
     })`,
    { docId: ids.docA3, userId: ids.userA }
  );
  for (let i = 0; i < ids.docA3Entities.length; i++) {
    await graphDb.run(
      `CREATE (e:Entity {
         id: $entityId, name: $name, normalizedName: $normalizedName,
         type: 'ORGANIZATION', description: 'pg-desc', aliases: [],
         mentionCount: 1, documentId: $docId, userId: $userId,
         needsEmbedding: false, firstSeenAt: datetime()
       })`,
      {
        entityId: ids.docA3Entities[i],
        name: docA3EntityNames[i],
        normalizedName: docA3EntityNames[i].toLowerCase(),
        docId: ids.docA3,
        userId: ids.userA,
      }
    );
  }
  for (let i = 0; i < ids.docA3Concepts.length; i++) {
    const c = docA3ConceptNames[i];
    await graphDb.run(
      `CREATE (c:Concept {
         id: $id, name: $name, normalizedName: $normalizedName, category: $category,
         description: 'pg-desc', mentionCount: 1, documentId: $docId, userId: $userId,
         needsEmbedding: false, firstSeenAt: datetime()
       })`,
      {
        id: ids.docA3Concepts[i],
        name: c.name,
        normalizedName: c.name.toLowerCase(),
        category: c.category,
        docId: ids.docA3,
        userId: ids.userA,
      }
    );
  }
  // Document -> MENTIONS -> Entity (5)
  for (const entityId of ids.docA3Entities) {
    await graphDb.run(
      `MATCH (d:Document {id: $docId}), (e:Entity {id: $entityId})
       CREATE (d)-[:MENTIONS {userId: $userId, documentId: $docId}]->(e)`,
      { docId: ids.docA3, entityId, userId: ids.userA }
    );
  }
  // Document -> DISCUSSES -> Concept (3)
  for (const conceptId of ids.docA3Concepts) {
    await graphDb.run(
      `MATCH (d:Document {id: $docId}), (c:Concept {id: $conceptId})
       CREATE (d)-[:DISCUSSES {userId: $userId, documentId: $docId}]->(c)`,
      { docId: ids.docA3, conceptId, userId: ids.userA }
    );
  }
  // Inter-entity custom edges
  const docA3CustomEdges: Array<[string, string, string]> = [
    [ids.docA3Entities[0], ids.docA3Entities[1], 'AGENCY_FIT'],
    [ids.docA3Entities[0], ids.docA3Entities[4], 'AGENCY_FIT'],
    [ids.docA3Entities[1], ids.docA3Entities[2], 'HAS_CAPABILITY'],
    [ids.docA3Entities[1], ids.docA3Entities[3], 'HAS_CAPABILITY'],
    [ids.docA3Entities[2], ids.docA3Entities[3], 'CONTROLLED_BY'],
  ];
  for (const [from, to, edgeType] of docA3CustomEdges) {
    await graphDb.run(
      `MATCH (a {id: $from}), (b {id: $to})
       CREATE (a)-[r:${edgeType} {userId: $userId, documentId: $docId}]->(b)`,
      { from, to, userId: ids.userA, docId: ids.docA3 }
    );
  }

  // ============================================================
  // docC1: isolation sentinel
  // ============================================================
  await graphDb.run(
    `CREATE (d:Document {
       id: $docId, userId: $userId, filename: 'docC1.pdf', uploadStatus: 'Completed',
       totalChunks: 1, totalTokens: 0, createdAt: datetime()
     })`,
    { docId: ids.docC1, userId: ids.userC }
  );
  const docC1ChunkId = makeId('k0c11', runSuffix);
  await graphDb.run(
    `MATCH (d:Document {id: $docId})
     CREATE (c:Chunk {
       id: $chunkId, content: 'sentinel chunk', contentNum: 0, tokenCount: 50,
       createdAt: datetime(), embeddingId: $embeddingId, summary: '',
       documentId: $docId, userId: $userId
     })
     CREATE (d)-[:CONTAINS {position: 0}]->(c)`,
    { docId: ids.docC1, userId: ids.userC, chunkId: docC1ChunkId, embeddingId: makeId('embc1', runSuffix) }
  );
  await graphDb.run(
    `CREATE (e:Entity {
       id: $entityId, name: 'Sentinel Entity', normalizedName: 'sentinel entity',
       type: 'ORGANIZATION', description: 'sentinel', aliases: [],
       mentionCount: 1, documentId: $docId, userId: $userId,
       needsEmbedding: false, firstSeenAt: datetime()
     })`,
    { entityId: ids.docC1Entity, docId: ids.docC1, userId: ids.userC }
  );

  // ============================================================
  // Admin-share Neo4j seed (optional)
  // ============================================================
  if (
    options.admin?.includeAdmin
    && ids.adminUserId
    && ids.docAdmin
    && ids.docAdminEntities
    && ids.docAdminConcepts
    && ids.docAdminChunks
  ) {
    // D_admin Document node — stamped with admin's userId, not the requester's.
    await graphDb.run(
      `CREATE (d:Document {
         id: $docId, userId: $userId, filename: 'docAdmin.pdf', uploadStatus: 'Completed',
         totalChunks: 2, totalTokens: 0, createdAt: datetime()
       })`,
      { docId: ids.docAdmin, userId: ids.adminUserId }
    );
    for (let i = 0; i < ids.docAdminChunks.length; i++) {
      await graphDb.run(
        `MATCH (d:Document {id: $docId})
         CREATE (c:Chunk {
           id: $chunkId, content: 'admin chunk ' + toString($i), contentNum: $i, tokenCount: 80,
           createdAt: datetime(), embeddingId: $embeddingId, summary: '',
           documentId: $docId, userId: $userId
         })
         CREATE (d)-[:CONTAINS {position: $i}]->(c)`,
        {
          docId: ids.docAdmin,
          userId: ids.adminUserId,
          chunkId: ids.docAdminChunks[i],
          i,
          embeddingId: makeId(`embAd${i}`, runSuffix),
        }
      );
    }
    // Entities — first one carries ADMIN_ONLY_TYPE so getScopedGraphSchema assertions can
    // target a value that doesn't appear in any other doc's graph.
    const docAdminEntityTypes = ['ADMIN_ONLY_TYPE', 'PERSON', 'PROCEDURE'];
    const docAdminEntityNames = ['Quarterly Report', 'Finance Director', 'Audit Procedure'];
    for (let i = 0; i < ids.docAdminEntities.length; i++) {
      await graphDb.run(
        `CREATE (e:Entity {
           id: $entityId, name: $name, normalizedName: $normalizedName,
           type: $type, description: $description, aliases: [],
           mentionCount: 1, documentId: $docId, userId: $userId,
           needsEmbedding: false, firstSeenAt: datetime()
         })`,
        {
          entityId: ids.docAdminEntities[i],
          name: docAdminEntityNames[i],
          normalizedName: docAdminEntityNames[i].toLowerCase(),
          type: docAdminEntityTypes[i],
          description: `admin-desc-${i}`,
          docId: ids.docAdmin,
          userId: ids.adminUserId,
        }
      );
    }
    // Concept
    await graphDb.run(
      `CREATE (c:Concept {
         id: $id, name: 'Regulatory Compliance', normalizedName: 'regulatory compliance',
         category: 'COMPLIANCE', description: 'admin-concept', mentionCount: 1,
         documentId: $docId, userId: $userId,
         needsEmbedding: false, firstSeenAt: datetime()
       })`,
      { id: ids.docAdminConcepts[0], docId: ids.docAdmin, userId: ids.adminUserId }
    );
    // Chunk -> entity mentions (2 total)
    await graphDb.run(
      `MATCH (c:Chunk {id: $chunkId}), (e:Entity {id: $entityId})
       CREATE (c)-[:MENTIONS {count: 1, positions: [0], confidence: 0.9, context: 'ctx', userId: $userId, documentId: $docId}]->(e)`,
      {
        chunkId: ids.docAdminChunks[0],
        entityId: ids.docAdminEntities[0],
        userId: ids.adminUserId,
        docId: ids.docAdmin,
      }
    );
    await graphDb.run(
      `MATCH (c:Chunk {id: $chunkId}), (e:Entity {id: $entityId})
       CREATE (c)-[:MENTIONS {count: 1, positions: [0], confidence: 0.9, context: 'ctx', userId: $userId, documentId: $docId}]->(e)`,
      {
        chunkId: ids.docAdminChunks[1],
        entityId: ids.docAdminEntities[1],
        userId: ids.adminUserId,
        docId: ids.docAdmin,
      }
    );
    // Inter-entity RELATED edge so one-hop expansion / shortest-path tests have something to return
    await graphDb.run(
      `MATCH (a:Entity {id: $from}), (b:Entity {id: $to})
       CREATE (a)-[:RELATED {id: randomUUID(), relationType: 'AUTHORED_BY', phase: 'extraction', description: 'rel', context: 'ctx', confidence: 0.9, decidedBy: 'rule', userId: $userId, documentId: $docId}]->(b)`,
      {
        from: ids.docAdminEntities[0],
        to: ids.docAdminEntities[1],
        userId: ids.adminUserId,
        docId: ids.docAdmin,
      }
    );
  }

  return ids;
}

export async function teardownShareTestGraph(
  graphDb: GraphDatabaseSource,
  prisma: PrismaClient,
  ids: SeededIds
): Promise<void> {
  const userIds = [ids.userA, ids.userB, ids.userC];
  if (ids.adminUserId) { userIds.push(ids.adminUserId); }

  const docIds = [ids.docA1, ids.docA2, ids.docA3, ids.docC1];
  if (ids.docAdmin) { docIds.push(ids.docAdmin); }

  // Neo4j: delete every node tagged for any of the seeded users (covers source + any target copies).
  await graphDb.run(
    `MATCH (n)
     WHERE n.userId IN $userIds
     DETACH DELETE n`,
    { userIds }
  );

  // Postgres: delete in dependency order.
  // Workflow rows reference users (createdBy) so they must clear before "User" rows go.
  if (ids.workflowId) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Workflow" WHERE id = '${ids.workflowId}'::uuid
    `);
  }

  const userIdList = userIds.map(id => `'${id}'`).join(',');
  const docIdList = docIds.map(id => `'${id}'`).join(',');

  await prisma.$executeRawUnsafe(`
    DELETE FROM graph_entity_embeddings WHERE "userId" IN (${userIdList})
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM graph_concept_embeddings WHERE "userId" IN (${userIdList})
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM "Embedding" WHERE "documentId" IN (${docIdList})
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM graph_metadata WHERE "userId" IN (${userIdList})
  `);
  // admin_document_groups cascades on Document delete, but clear it first defensively in case
  // a prior run aborted between the join-table insert and the Document insert.
  if (ids.docAdmin) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM admin_document_groups WHERE "documentId" = '${ids.docAdmin}'::uuid
    `);
    await prisma.$executeRawUnsafe(`
      DELETE FROM "_AdminDocumentAccess" WHERE "A" = '${ids.docAdmin}'::uuid
    `);
  }
  await prisma.$executeRawUnsafe(`
    DELETE FROM "Document" WHERE "userId" IN (${userIdList})
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM "DocumentUploadProvider" WHERE id = '${ids.uploadProviderId}'::uuid
  `);
  // UserGroup memberships cascade on UserGroup delete, but UserGroup itself must clear
  // before "User" deletes if a membership row still references the user.
  if (ids.financeGroupId || ids.marketingGroupId) {
    const groupIds = [ids.financeGroupId, ids.marketingGroupId].filter(Boolean);
    const groupIdList = groupIds.map(id => `'${id}'`).join(',');
    await prisma.$executeRawUnsafe(`
      DELETE FROM "UserGroupMembership" WHERE "userGroupId" IN (${groupIdList})
    `);
    await prisma.$executeRawUnsafe(`
      DELETE FROM "UserGroup" WHERE id IN (${groupIdList})
    `);
  }
  await prisma.$executeRawUnsafe(`
    DELETE FROM "User" WHERE id IN (${userIdList.replace(/'([0-9a-f-]+)'/gi, '\'$1\'::uuid')})
  `);
}
