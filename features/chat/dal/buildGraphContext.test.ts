import { buildGraphContext } from '@/features/chat/dal/buildGraphContext';
import { getOneHopExpansion } from '@/features/graph-database/services/graphQueries';
import { EntitySearchResult } from '@/features/chat/dal/getEntitiesForQuery';
import { ConceptSearchResult } from '@/features/chat/dal/getConceptsForQuery';
import { Citation, ContextType } from '@/features/chat/types/message';

jest.mock('@/features/graph-database/services/graphQueries', () => ({
  getOneHopExpansion: jest.fn(),
}));

describe('buildGraphContext', () => {
  const mockDocumentIds = ['doc-123', 'doc-456'];

  const mockEntities: EntitySearchResult[] = [
    {
      id: 'entity-1',
      entityName: 'GraphRAG',
      description: 'A graph-based retrieval augmented generation system',
      aliases: ['Graph RAG', 'Graph-RAG'],
      documentId: 'doc-123',
      score: 0.7028,
    },
    {
      id: 'entity-2',
      entityName: 'Knowledge Graph',
      description: 'A structured representation of real-world entities and relationships',
      aliases: ['KG'],
      documentId: 'doc-123',
      score: 0.65,
    },
  ];

  const mockConcepts: ConceptSearchResult[] = [
    {
      id: 'concept-1',
      conceptName: 'Retrieval Augmented Generation',
      description: 'A technique that enhances LLM responses with retrieved context',
      category: 'TECHNICAL',
      documentId: 'doc-123',
      score: 0.68,
    },
  ];

  const mockChunks: Citation[] = [
    {
      citation: 'GraphRAG uses community reports for global sensemaking...',
      sourceLabel: 'graphrag-paper.pdf (page 3)',
      contextType: ContextType.DOCUMENT_LIBRARY,
      documentId: 'doc-123',
      embeddingId: 'emb-1',
    },
  ];

  const mockOneHopResults = [
    {
      anchor: { id: 'entity-1', name: 'GraphRAG', type: 'ENTITY' as const },
      relationship: {
        type: 'DEVELOPED_BY',
        description: 'Microsoft Research developed GraphRAG',
        sourceName: 'GraphRAG',
        targetName: 'Microsoft',
      },
      neighbor: {
        id: 'neighbor-1',
        name: 'Microsoft',
        description: 'A technology company',
        type: 'ORGANIZATION',
      },
    },
    {
      anchor: { id: 'concept-1', name: 'Retrieval Augmented Generation', type: 'CONCEPT' as const },
      relationship: {
        type: 'RELATED_TO',
        description: 'RAG improves LLM accuracy',
        sourceName: 'Retrieval Augmented Generation',
        targetName: 'LLM',
      },
      neighbor: {
        id: 'neighbor-2',
        name: 'LLM',
        description: 'Large Language Model',
        type: 'CONCEPT',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getOneHopExpansion as jest.Mock).mockResolvedValue(mockOneHopResults);
  });

  it('should return empty context when no entities or concepts provided', async () => {
    const result = await buildGraphContext([], [], mockDocumentIds);

    expect(result).toEqual({
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [],
      shortestPaths: [],
    });
    expect(getOneHopExpansion).not.toHaveBeenCalled();
  });

  it('should call getOneHopExpansion with entity IDs, concept IDs, and documentIds', async () => {
    const result = await buildGraphContext(mockEntities, mockConcepts, mockDocumentIds, mockChunks);

    expect(getOneHopExpansion).toHaveBeenCalledWith(
      ['entity-1', 'entity-2'],
      ['concept-1'],
      mockDocumentIds
    );
    expect(result.entities).toEqual(mockEntities);
    expect(result.concepts).toEqual(mockConcepts);
    expect(result.chunks).toEqual(mockChunks);
    expect(result.oneHopResults).toEqual(mockOneHopResults);
  });

  it('should continue without one-hop results when query fails', async () => {
    (getOneHopExpansion as jest.Mock).mockRejectedValue(
      new Error('Neo4j connection failed')
    );

    const result = await buildGraphContext(mockEntities, mockConcepts, mockDocumentIds, mockChunks);

    expect(result.entities).toEqual(mockEntities);
    expect(result.concepts).toEqual(mockConcepts);
    expect(result.chunks).toEqual(mockChunks);
    expect(result.oneHopResults).toEqual([]);
  });

  it('should work with concepts only (no entities)', async () => {
    const result = await buildGraphContext([], mockConcepts, mockDocumentIds, mockChunks);

    expect(getOneHopExpansion).toHaveBeenCalledWith([], ['concept-1'], mockDocumentIds);
    expect(result.entities).toEqual([]);
    expect(result.concepts).toEqual(mockConcepts);
    expect(result.chunks).toEqual(mockChunks);
  });

  it('should work with entities only (no concepts)', async () => {
    const result = await buildGraphContext(mockEntities, [], mockDocumentIds, mockChunks);

    expect(getOneHopExpansion).toHaveBeenCalledWith(['entity-1', 'entity-2'], [], mockDocumentIds);
    expect(result.entities).toEqual(mockEntities);
    expect(result.concepts).toEqual([]);
    expect(result.chunks).toEqual(mockChunks);
  });

  it('should work with single entity', async () => {
    const singleEntity = [mockEntities[0]];
    const result = await buildGraphContext(singleEntity, [], mockDocumentIds, []);

    expect(getOneHopExpansion).toHaveBeenCalledWith(['entity-1'], [], mockDocumentIds);
    expect(result.entities).toEqual(singleEntity);
    expect(result.concepts).toEqual([]);
    expect(result.chunks).toEqual([]);
  });

  it('should default chunks to empty array when not provided', async () => {
    const result = await buildGraphContext(mockEntities, mockConcepts, mockDocumentIds);

    expect(result.chunks).toEqual([]);
    expect(result.entities).toEqual(mockEntities);
    expect(result.concepts).toEqual(mockConcepts);
  });

  it('should skip one-hop expansion when documentIds is empty', async () => {
    const result = await buildGraphContext(mockEntities, mockConcepts, [], mockChunks);

    expect(getOneHopExpansion).not.toHaveBeenCalled();
    expect(result.oneHopResults).toEqual([]);
    expect(result.entities).toEqual(mockEntities);
  });
});
