# Document Knowledge Graph with Neo4j

This feature builds a knowledge graph from uploaded documents on-demand, extracting entities, concepts, and relationships to enable advanced querying and exploration.

## Overview

**Graph building is now on-demand and user-initiated in the chat interface:**

1. User uploads documents to Document Library (standard upload flow)
2. Text is chunked (800 tokens with 150 token overlap)
3. Embeddings are created and stored in PostgreSQL (with HNSW index)
4. **User selects documents in chat and toggles graph mode**
5. Graph is built asynchronously via BullMQ worker:
   - Entities and concepts are extracted using AI
   - Knowledge graph is built in Neo4j
   - Chunks are connected with NEXT/PREVIOUS relationships
   - Entities and concepts are linked to chunks with MENTIONS/DISCUSSES relationships
6. Graph can be reused across multiple chats with the same document set

**Important:** Graphs are only created for Document Library documents, not Knowledge Bases.

**Skip LLM extraction with palm-graph JSON:** documents whose text is JSON in the palm-graph shape are routed straight to Neo4j without entity extraction. See [json-upload.md](./json-upload.md) for the required shape and validation rules.

## Database Schema

### GraphMetadata Table (PostgreSQL)

The `GraphMetadata` table tracks graph build status and enables reuse:

```typescript
model GraphMetadata {
  id            String    @id @default(uuid())
  graphId       String    @unique              // Hash-based: graph_userId_hash
  userId        String                         // Owner of the graph
  documentIds   String[]                       // Array of document UUIDs
  status        String    @default("Pending")  // Pending | Building | Completed | Failed
  createdAt     DateTime  @default(now())
  completedAt   DateTime?
  expiresAt     DateTime                       // 7-day TTL for cleanup
  buildProgress Json?                          // { totalChunks, processedChunks, currentStep }
  errorMessage  String?
}
```

**Key Points:**
- `graphId` is unique - prevents duplicate graphs for same document set
- `documentIds` array stored for reference and validation
- `buildProgress` tracks real-time progress for UI polling
- `expiresAt` enables automatic cleanup of old graphs

## Neo4j Graph Schema

### Node Types
- **Document**: Represents uploaded documents
- **Chunk**: Text chunks from documents
- **Entity**: Named entities (people, organizations, technologies, etc.)
- **Concept**: Key concepts and ideas

### Relationship Types
- `CONTAINS`: Document → Chunk
- `NEXT/PREVIOUS`: Chunk → Chunk (sequential navigation)
- `MENTIONS`: Chunk → Entity
- `DISCUSSES`: Chunk → Concept
- `SIMILAR_TO`: Chunk → Chunk (based on embeddings)
- `RELATED`: Entity/Concept → Entity/Concept (typed relationships from LLM extraction)
- `IDENTITY`: Entity → Entity or Concept → Concept (resolution: same real-world entity)
- `SIMILAR`: Concept → Concept (resolution: semantically similar concepts)

## Installation

### 1. Install Neo4j Driver

```bash
npm install neo4j-driver
```

Or if using yarn:
```bash
yarn add neo4j-driver
```

### 2. Start Neo4j Database

The Neo4j service is already configured in `docker-compose.yml`. Start it with:

```bash
docker-compose up -d neo4j
```

Wait ~10 seconds for Neo4j to fully start.

This will:
- Start Neo4j on ports 7474 (HTTP) and 7687 (Bolt)
- Create persistent volumes for data
- Install APOC plugin for advanced queries
- Set default credentials: neo4j/password

### 3. Verify Neo4j is Running

Access the Neo4j Browser at http://localhost:7474
- Username: neo4j
- Password: password

### 4. Restart Services

```bash
docker-compose restart frontend
```

Note: The graph build worker runs within the main Next.js app (frontend container), not in a separate worker container.

### 5. Test the Setup

1. Start the frontend: http://localhost:3000
2. Navigate to Document Library
3. Upload a test document (PDF, DOCX, or TXT)
4. Select the document in chat and toggle graph mode
5. Wait for graph building to complete
6. Verify data in Neo4j Browser (http://localhost:7474):

```cypher
MATCH (n) RETURN count(n)
```

You should see nodes created for your document.

## Environment Variables

Add to `.env.local`:

```bash
# Neo4j Configuration (for Document Graph Database)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
```

## User Interface

### Graph Controls in Chat

The graph feature is integrated into the chat interface with two main controls:

#### 1. Graph Build Button (Sources Sidebar)
Located in the Sources sidebar, the "Graph" button allows users to build a knowledge graph from selected documents:

1. Select one or more documents from Document Library
2. Click the "Graph" button in the sidebar
3. Progress indicator shows build status
4. Once completed, documents display a "GRAPHED" badge

#### 2. Vector/Graph Toggle (Chat Input)
A segmented control in the chat input area lets users switch between search modes:

- **Vector icon**: Standard RAG using vector similarity search
- **Network icon**: Graph-enhanced RAG with entity/concept enrichment

The graph toggle is only enabled when at least one selected document has been graphed. When graph mode is active, chat responses include:
- Entity and concept metadata from the knowledge graph
- Related chunks from other documents sharing the same entities
- Sequential context (previous/next chunks) from source documents

## API Endpoints

All graph endpoints are available under `trpc.graphDatabase`:

### 1. Build Graph (On-Demand)
```typescript
const result = await trpc.graphDatabase.buildGraph.mutate({
  documentIds: ["uuid1", "uuid2"]
});

// Returns:
{
  graphId: string;              // Hash-based ID for reuse
  status: "Pending" | "Building" | "Completed" | "Failed";
  jobId: string;
  isRebuilding: boolean;        // True if modifying existing graph
  estimatedTimeSeconds?: number;
}
```

### 2. Get Graph Status
```typescript
const status = await trpc.graphDatabase.getGraphStatus.query({
  graphId: "graph_userId_hash"
});

// Returns:
{
  graphId: string;
  status: "Pending" | "Building" | "Completed" | "Failed";
  progress?: number;            // 0-100
  totalChunks?: number;
  processedChunks?: number;
  currentStep?: string;
  errorMessage?: string;
  completedAt?: Date;
}
```

## Example Cypher Queries

You can run these directly in Neo4j Browser (http://localhost:7474):

### Find all documents mentioning an entity
```cypher
MATCH (e:Entity {name: "AWS"})<-[:MENTIONS]-(c:Chunk)<-[:CONTAINS]-(d:Document)
RETURN DISTINCT d.filename, count(c) as mentions
ORDER BY mentions DESC
```

### Find related entities via typed relationships
```cypher
MATCH (e1:Entity {name: "AWS"})-[r:RELATED]->(e2:Entity)
RETURN e2.name, e2.type, r.relationType, r.description
ORDER BY r.confidence DESC
```

### Find all variants of an entity (via resolution)
```cypher
MATCH (e:Entity {name: "DHA"})-[:IDENTITY*1..5]-(variant:Entity)
RETURN DISTINCT variant.name, variant.type
```

### Find documents discussing a concept
```cypher
MATCH (con:Concept {name: "Cloud Computing"})<-[d:DISCUSSES]-(c:Chunk)<-[:CONTAINS]-(doc:Document)
RETURN DISTINCT doc.filename, avg(d.relevance) as relevance
ORDER BY relevance DESC
```

### Navigate chunk sequence with context
```cypher
MATCH (c:Chunk {id: "chunk-uuid-here"})
OPTIONAL MATCH (c)-[:PREVIOUS]->(prev)
OPTIONAL MATCH (c)-[:NEXT]->(next)
OPTIONAL MATCH (c)-[:MENTIONS]->(e:Entity)
RETURN c, prev, next, collect(e.name) as entities
```

### Find conceptually related documents
```cypher
MATCH (d1:Document {id: "doc-uuid"})-[:CONTAINS]->(c1)-[:DISCUSSES]->(con:Concept)
MATCH (con)<-[:DISCUSSES]-(c2)<-[:CONTAINS]-(d2:Document)
WHERE d1.id <> d2.id
RETURN DISTINCT d2.filename, count(con) as sharedConcepts
ORDER BY sharedConcepts DESC
LIMIT 10
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    On-Demand Graph Building Flow             │
└─────────────────────────────────────────────────────────────┘

Phase 1: Document Upload (Standard Flow)
1. User uploads document to Document Library
2. Document is parsed and chunked
3. Embeddings created (PostgreSQL + pgvector)
4. Document ready for chat

Phase 2: Graph Building (User-Initiated in Chat)
1. User selects documents in chat
2. User toggles graph mode on
3. System checks for existing graph with same document set
   - If exists and completed: reuse immediately
   - If exists and building: show progress
   - If new: create graph metadata and queue job
4. BullMQ worker processes job:
   - Fetch document chunks
   - Extract entities and concepts (using AI)
   - Build Neo4j graph structure
   - Create relationships
   - Update progress
5. Graph completed and ready for chat
6. Same graph can be reused in other chats with identical document set

┌─────────────────────────────────────────────────────────────┐
│                    Worker Architecture                       │
└─────────────────────────────────────────────────────────────┘

- Graph build worker runs in main Next.js app (pages/api/trpc/[trpc].ts)
- Starts alongside other workers (RADAR, RCAST, DeepResearch)
- Uses BullMQ for job queue management
- Processes graph builds asynchronously
- Updates GraphMetadata table with progress

┌─────────────────────────────────────────────────────────────┐
│                    Graph Reuse Strategy                      │
└─────────────────────────────────────────────────────────────┘

- Graph ID: graph_{userId}_{hash(sortedDocumentIds)}
- Same document set = same graph ID = graph reuse
- Different documents = different hash = new graph
- Adding/removing documents = new graph
- 7-day TTL for cleanup
```

## Performance Considerations

### Entity Extraction
- Processes 3 chunks in parallel by default
- Uses low temperature (0.1) for consistent extraction
- Caches results in graph database

### Graph Building
- On-demand building - only when user requests it
- Uses batch transactions for performance
- Creates indexes on frequently queried fields
- Full-text indexes on entity/concept names
- Runs asynchronously via BullMQ worker
- Doesn't block chat functionality
- Progress updates every 3 seconds via polling

### Graph Reuse and Deduplication
**How graphs are linked to prevent duplicate creation:**
- Graph ID is generated using: `graph_{userId}_{hash(sortedDocumentIds)}`
- Hash is created from SHA-256 of sorted document IDs
- Before building, system checks `GraphMetadata` table for existing graph with same ID
- If existing graph is found:
  - **Status: Completed** → Reuse immediately, no new build
  - **Status: Building** → Show existing build progress, no new job
  - **Status: Failed/Pending** → Retry the build
- Multiple chats with same document set share the same graph
- Adding/removing documents changes the hash → creates new graph
- Example:
  - User A selects docs [doc1, doc2] → Creates graph_userA_abc123
  - User A creates new chat with [doc1, doc2] → Reuses graph_userA_abc123
  - User A selects [doc1, doc2, doc3] → Creates new graph_userA_def456
  - User B selects [doc1, doc2] → Creates graph_userB_abc123 (different user)

### Query Performance
- Constraints ensure unique nodes
- Indexes on: entity names, types, user IDs, graph IDs
- Full-text search indexes for content
- Use `LIMIT` clauses for large result sets

## Troubleshooting

### Neo4j Connection Issues
```bash
# Check if Neo4j is running
docker ps | grep neo4j

# Check Neo4j logs
docker logs neo4j

# Restart Neo4j
docker-compose restart neo4j

# Common fix: clear old data and restart
docker-compose down
docker volume rm palm-oss_neo4j-data
docker-compose up -d neo4j
```

**Note:** In Docker environments, use `NEO4J_URI=bolt://neo4j:7687` (service name), not `bolt://localhost:7687`.

### Graph Not Building
```bash
# Check worker logs (runs in frontend container)
docker logs frontend | grep -i graph

# Check specific graph build logs
docker logs frontend | grep "Graph build"

# Verify Neo4j connection
docker logs frontend | grep -i neo4j

# Check Redis/BullMQ connection
docker logs frontend | grep -i bull
```

### Clear Graph Data
```cypher
// WARNING: Deletes all graph data
MATCH (n)
DETACH DELETE n
```

### Clear Graph for Specific Document
```cypher
MATCH (d:Document {id: "doc-uuid"})
OPTIONAL MATCH (d)-[:CONTAINS]->(c:Chunk)
DETACH DELETE d, c
```

### Cleanup Script

For comprehensive cleanup of graph embeddings and metadata, use the cleanup script:

```bash
# Preview what would be deleted (dry run)
docker exec -it frontend npx ts-node prisma/scripts/cleanup-graph-embeddings.ts

# Actually delete orphaned data
docker exec -it frontend npx ts-node prisma/scripts/cleanup-graph-embeddings.ts --force
```

See `prisma/scripts/cleanup-graph-embeddings.ts` for details on what gets cleaned up.

## Resources

- **Neo4j Browser**: http://localhost:7474
- **Cypher Query Language**: https://neo4j.com/docs/cypher-manual/current/
- **Graph Data Science**: https://neo4j.com/docs/graph-data-science/current/
- **Neo4j Driver Documentation**: https://neo4j.com/docs/javascript-manual/current/
