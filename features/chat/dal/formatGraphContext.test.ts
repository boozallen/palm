import { formatGraphContextForLLM } from '@/features/chat/dal/formatGraphContext';
import { GraphContext } from '@/features/chat/dal/buildGraphContext';
import { ContextType } from '@/features/chat/types/message';

describe('formatGraphContextForLLM', () => {
  it('should return empty string when context is completely empty', () => {
    const emptyContext: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [],
      shortestPaths: [],
    };

    expect(formatGraphContextForLLM(emptyContext)).toBe('');
  });

  it('should format anchors section with entities', () => {
    const context: GraphContext = {
      entities: [
        {
          id: 'entity-1',
          entityName: 'GraphRAG',
          description: 'A graph-based retrieval system',
          aliases: ['Graph RAG'],
          documentId: 'doc-123',
          score: 0.7,
        },
      ],
      concepts: [],
      chunks: [],
      oneHopResults: [],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('## Semantic Search Context:');
    expect(result).toContain('### Semantic Matches:');
    expect(result).toContain('**GraphRAG** (ENTITY)');
    expect(result).toContain('A graph-based retrieval system');
  });

  it('should format anchors section with concepts', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [
        {
          id: 'concept-1',
          conceptName: 'Machine Learning',
          description: 'A subset of AI that learns from data',
          category: 'TECHNICAL',
          documentId: 'doc-123',
          score: 0.65,
        },
      ],
      chunks: [],
      oneHopResults: [],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('**Machine Learning** (CONCEPT)');
    expect(result).toContain('A subset of AI that learns from data');
  });

  it('should format anchors section with chunks', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [
        {
          citation: 'GraphRAG uses community reports for global sensemaking...',
          sourceLabel: 'graphrag-paper.pdf (page 3)',
          contextType: ContextType.DOCUMENT_LIBRARY,
          documentId: 'doc-123',
          embeddingId: 'emb-1',
        },
      ],
      oneHopResults: [],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('**graphrag-paper.pdf (page 3)** (CHUNK)');
    expect(result).toContain('"GraphRAG uses community reports for global sensemaking..."');
  });

  it('should format connected context section with one-hop neighbors', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [
        {
          anchor: { id: 'entity-1', name: 'GraphRAG', type: 'ENTITY' },
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
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('### One-Hop Expansion:');
    expect(result).toContain('**Microsoft** (ORGANIZATION)');
    expect(result).toContain('A technology company');
    expect(result).toContain('- Relationship: DEVELOPED_BY');
    expect(result).toContain('Source: GraphRAG, Target: Microsoft');
    expect(result).toContain('Description: "Microsoft Research developed GraphRAG"');
  });

  it('should use source/target format (not arrows)', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [
        {
          anchor: { id: 'entity-1', name: 'HiRAG', type: 'ENTITY' },
          relationship: {
            type: 'OUTPERFORMS',
            sourceName: 'HiRAG',
            targetName: 'NaiveRAG',
          },
          neighbor: {
            id: 'neighbor-1',
            name: 'NaiveRAG',
            type: 'METHOD',
          },
        },
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('Source: HiRAG, Target: NaiveRAG');
    expect(result).not.toContain('-->');
    expect(result).not.toContain('->');
    expect(result).not.toContain('<-');
  });

  it('should deduplicate neighbors by ID and aggregate relationships', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [
        {
          anchor: { id: 'entity-1', name: 'GraphRAG', type: 'ENTITY' },
          relationship: {
            type: 'DEVELOPED_BY',
            sourceName: 'GraphRAG',
            targetName: 'Microsoft',
          },
          neighbor: {
            id: 'neighbor-1',
            name: 'Microsoft',
            type: 'ORGANIZATION',
          },
        },
        {
          anchor: { id: 'entity-2', name: 'LightRAG', type: 'ENTITY' },
          relationship: {
            type: 'FUNDED',
            sourceName: 'Microsoft',
            targetName: 'LightRAG',
          },
          neighbor: {
            id: 'neighbor-1', // Same neighbor ID
            name: 'Microsoft',
            type: 'ORGANIZATION',
          },
        },
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    // Microsoft should appear only once
    const microsoftMatches = result.match(/\*\*Microsoft\*\*/g);
    expect(microsoftMatches?.length).toBe(1);

    // Both relationships should be aggregated under Microsoft
    expect(result).toContain('- Relationship: DEVELOPED_BY');
    expect(result).toContain('- Relationship: FUNDED');
  });

  it('should sort neighbors by connection count (most connected first)', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [
        // SingleConnection has 1 relationship
        {
          anchor: { id: 'entity-1', name: 'EntityA', type: 'ENTITY' },
          relationship: { type: 'REL1', sourceName: 'EntityA', targetName: 'SingleConnection' },
          neighbor: { id: 'neighbor-1', name: 'SingleConnection', type: 'ENTITY' },
        },
        // MostConnected has 2 relationships
        {
          anchor: { id: 'entity-2', name: 'EntityB', type: 'ENTITY' },
          relationship: { type: 'REL2', sourceName: 'EntityB', targetName: 'MostConnected' },
          neighbor: { id: 'neighbor-2', name: 'MostConnected', type: 'ENTITY' },
        },
        {
          anchor: { id: 'entity-3', name: 'EntityC', type: 'ENTITY' },
          relationship: { type: 'REL3', sourceName: 'EntityC', targetName: 'MostConnected' },
          neighbor: { id: 'neighbor-2', name: 'MostConnected', type: 'ENTITY' },
        },
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    // MostConnected should appear before SingleConnection
    const mostConnectedIndex = result.indexOf('**MostConnected**');
    const singleConnectionIndex = result.indexOf('**SingleConnection**');
    expect(mostConnectedIndex).toBeLessThan(singleConnectionIndex);
  });

  it('should format all sections when all data is present', () => {
    const context: GraphContext = {
      entities: [
        {
          id: 'entity-1',
          entityName: 'GraphRAG',
          description: 'Graph retrieval system',
          aliases: [],
          documentId: 'doc-123',
          score: 0.7,
        },
      ],
      concepts: [
        {
          id: 'concept-1',
          conceptName: 'RAG',
          description: 'Retrieval augmented generation',
          category: 'TECHNICAL',
          documentId: 'doc-123',
          score: 0.6,
        },
      ],
      chunks: [
        {
          citation: 'Some chunk content...',
          sourceLabel: 'doc.pdf (page 1)',
          contextType: ContextType.DOCUMENT_LIBRARY,
          documentId: 'doc-123',
        },
      ],
      oneHopResults: [
        {
          anchor: { id: 'entity-1', name: 'GraphRAG', type: 'ENTITY' },
          relationship: {
            type: 'USES',
            sourceName: 'GraphRAG',
            targetName: 'KnowledgeGraph',
          },
          neighbor: {
            id: 'neighbor-1',
            name: 'KnowledgeGraph',
            type: 'CONCEPT',
          },
        },
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('## Semantic Search Context:');
    expect(result).toContain('### Semantic Matches:');
    expect(result).toContain('**GraphRAG** (ENTITY)');
    expect(result).toContain('**RAG** (CONCEPT)');
    expect(result).toContain('**doc.pdf (page 1)** (CHUNK)');
    expect(result).toContain('### One-Hop Expansion:');
    expect(result).toContain('**KnowledgeGraph** (CONCEPT)');
    expect(result).toContain('Source: GraphRAG, Target: KnowledgeGraph');
  });

  it('should handle neighbors without description', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [
        {
          anchor: { id: 'entity-1', name: 'EntityA', type: 'ENTITY' },
          relationship: {
            type: 'RELATES_TO',
            sourceName: 'EntityA',
            targetName: 'NoDescNeighbor',
          },
          neighbor: {
            id: 'neighbor-1',
            name: 'NoDescNeighbor',
            type: 'ENTITY',
            // No description
          },
        },
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('**NoDescNeighbor** (ENTITY)');
    // Should not have a trailing colon or undefined
    expect(result).not.toContain('(ENTITY):');
    expect(result).not.toContain('undefined');
  });

  it('should handle relationships without description', () => {
    const context: GraphContext = {
      entities: [],
      concepts: [],
      chunks: [],
      oneHopResults: [
        {
          anchor: { id: 'entity-1', name: 'EntityA', type: 'ENTITY' },
          relationship: {
            type: 'RELATES_TO',
            sourceName: 'EntityA',
            targetName: 'EntityB',
            // No description
          },
          neighbor: {
            id: 'neighbor-1',
            name: 'EntityB',
            type: 'ENTITY',
          },
        },
      ],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('- Relationship: RELATES_TO');
    expect(result).toContain('Source: EntityA, Target: EntityB');
    // Should not have Description line
    expect(result).not.toContain('Description:');
  });

  it('should handle entities without description', () => {
    const context: GraphContext = {
      entities: [
        {
          id: 'entity-1',
          entityName: 'SimpleEntity',
          description: '',
          aliases: [],
          documentId: 'doc-123',
          score: 0.5,
        },
      ],
      concepts: [],
      chunks: [],
      oneHopResults: [],
      shortestPaths: [],
    };

    const result = formatGraphContextForLLM(context);

    expect(result).toContain('**SimpleEntity** (ENTITY)');
    // No trailing colon for empty description
    expect(result).not.toContain('(ENTITY):');
  });
});
