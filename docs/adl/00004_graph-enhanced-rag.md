# ADR 4: Graph-Enhanced RAG Integration

## Context

The existing RAG (Retrieval-Augmented Generation) system uses vector similarity search to find relevant document chunks when answering user questions. While effective for semantic matching, this approach has limitations:

1. **Isolated chunks**: Vector search returns individual chunks without understanding relationships between them
2. **Missing entity connections**: Related information spread across multiple documents isn't connected
3. **No cross-document reasoning**: The system cannot identify when different chunks discuss the same entities or concepts

A knowledge graph can address these limitations by:
- Storing entities, concepts, and relationships extracted from documents
- Enabling traversal between related chunks through shared entities
- Providing sequential context (previous/next chunks in a document)

## Decision

We will implement a hybrid RAG approach that combines vector similarity search with graph-based enhancement:

### 1. Graph Enhancement Toggle
- Add a `useGraph` boolean parameter to the chat message API
- Users can toggle between "Vector" (standard RAG) and "Graph-enhanced" search modes via a UI control
- The toggle is only enabled when at least one selected document has been graphed

### 2. Citation Enhancement Flow
When `useGraph` is enabled:
1. Perform standard vector similarity search to find matching embeddings
2. For each embedding result, look up the corresponding chunk in Neo4j
3. Retrieve associated entities and concepts from the graph
4. Find related chunks through shared entities (up to 3 per citation)
5. Include sequential context (previous/next chunks) when available
6. Enrich citations with this metadata before passing to the LLM

### 3. Embedding ID Tracking
- Add `embeddingId` field to the Citation type to link RAG results to graph nodes
- Store embedding IDs in citation objects returned by `getEmbeddingsForDocuments`
- Use embedding IDs as chunk identifiers when querying the graph

### 4. Logging Prefixes
Implement consistent log prefixes for different subsystems to aid debugging:
- `[CHAT]` - Chat message submission and processing
- `[RAG]` - Vector similarity search operations
- `[GRAPH-BUILD]` - Graph construction worker
- `[GRAPH-QUERY]` - Graph queries during chat enhancement
- `[GRAPH-EXTRACT]` - Entity extraction from document chunks
- `[EMBED]` - Embedding creation
- `[DOC-UPLOAD]` - Document upload processing

## Status

Accepted

## Consequences

### Positive Consequences
- Richer context for LLM responses through entity and relationship metadata
- Cross-document reasoning when chunks share entities
- Better handling of multi-part documents through sequential chunk linking
- Improved debuggability through consistent log prefixes
- User control over search mode (can disable graph for simpler queries)

### Negative Consequences
- Additional latency when graph enhancement is enabled (Neo4j queries)
- Graph data must be built before enhancement is available
- Increased complexity in citation processing pipeline
- Graph enhancement only works for documents that have been graphed

### Neutral Consequences
- Graph toggle state is preserved in URL query parameters for shareability
- Feature access is controlled by user group permissions
- Falls back gracefully to standard citations if graph queries fail

## References

- Neo4j Graph Database: https://neo4j.com/
- GraphRAG concepts: https://microsoft.github.io/graphrag/
- Existing RAG chunking ADR: [00001_rag-chunking.md](./00001_rag-chunking.md)
- Existing embedding model ADR: [00002_rag-embedding-model.md](./00002_rag-embedding-model.md)

## Alternatives

### Alternative 1: Graph-Only Search
Replace vector search entirely with graph-based retrieval. Rejected because:
- Vector search is still more effective for semantic similarity
- Would require all documents to be graphed before use
- Graph queries alone don't capture semantic nuance as well

### Alternative 2: Automatic Graph Enhancement
Always use graph enhancement when available, without user toggle. Rejected because:
- Adds latency for simple queries that don't need cross-document context
- Users may want faster responses for straightforward questions
- Gives users control over the tradeoff

## Appendix

### Files Modified

**Core Integration:**
- `features/chat/routes/add-message.ts` - Added graph enhancement call and logging
- `features/chat/dal/enhanceDocumentLibraryWithGraph.ts` - Graph enhancement logic
- `features/chat/dal/getEmbeddingsForDocuments.ts` - Added embeddingId to citations
- `features/chat/types/message.ts` - Added embeddingId to Citation type

**UI Components:**
- `features/chat/components/forms/ChatForm.tsx` - Graph toggle control
- `features/chat/providers/ChatProvider.tsx` - useGraph state management
- `features/chat/components/content/sources/SourcesSidebar.tsx` - Graph build button
- `features/chat/components/content/sources/ExpandedSourcesList.tsx` - Graphed indicators
- `features/chat/components/content/sources/CollapsedSourcesList.tsx` - Graphed indicators

**Worker Logging:**
- `features/chat/utils/worker/worker.ts` - [CHAT] prefixes
- `features/document-upload-provider/workers/documentUploadWorker.ts` - [DOC-UPLOAD]/[EMBED] prefixes
- `features/graph-database/utils/worker/worker.ts` - [GRAPH-BUILD] prefixes
- `features/graph-database/services/entityExtractor.ts` - [GRAPH-EXTRACT] prefixes

### EnrichedDocumentCitation Type

```typescript
type EnrichedDocumentCitation = Citation & {
  entities?: string[];
  concepts?: string[];
  relatedChunks?: Array<{
    content: string;
    source: string;
    reason: string;
  }>;
};
```
