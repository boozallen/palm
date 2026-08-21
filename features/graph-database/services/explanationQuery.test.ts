import { explanationQuery } from './explanationQuery';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import { buildGraphContext } from '@/features/chat/dal/buildGraphContext';
import { AIFactory } from '@/features/ai-provider/factory';
import {
  extractSearchTerms,
  hybridEntitySearch,
  hybridConceptSearch,
  filterAnchorsForRelevance,
} from '@/features/graph-database/services/search';

jest.mock('@/features/shared/dal/document-library/upload/embedContent');
jest.mock('@/features/chat/dal/getEmbeddingsForDocuments');
jest.mock('@/features/chat/dal/buildGraphContext');
jest.mock('@/features/ai-provider/factory');
jest.mock('@/features/graph-database/services/search', () => ({
  extractSearchTerms: jest.fn().mockResolvedValue({ terms: ['test'] }),
  hybridEntitySearch: jest.fn().mockResolvedValue([]),
  hybridConceptSearch: jest.fn().mockResolvedValue([]),
  scoreGapFilter: jest.requireActual('@/features/graph-database/services/search/scoreGapFilter').scoreGapFilter,
  filterAnchorsForRelevance: jest.fn(),
}));
jest.mock('@/features/graph-database/services/graphQueries', () => ({
  findShortestPaths: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(new Set(['doc-1', 'doc-2'])),
}));
jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockEmbedding = [0.1, 0.2, 0.3];
const mockCitation = {
  citation: { contextType: 'DOCUMENT_LIBRARY', documentId: 'doc-1', sourceLabel: 'test.pdf', citation: 'content' },
};
const mockEntity = { id: 'e1', entityName: 'TestEntity', description: 'desc', aliases: [], documentId: 'doc-1', score: 0.7 };
const mockConcept = { id: 'c1', conceptName: 'TestConcept', description: 'desc', category: 'TECHNICAL', documentId: 'doc-1', score: 0.6 };
const mockGraphContext = { entities: [mockEntity], concepts: [mockConcept], chunks: [], oneHopResults: [], shortestPaths: [] };

describe('explanationQuery', () => {
  const params = { query: 'What is X?', documentIds: ['doc-1'], userId: 'user-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    (embedContent as jest.Mock).mockResolvedValue({ embeddings: [{ embedding: mockEmbedding }] });
    (getEmbeddingsForDocuments as jest.Mock).mockResolvedValue([mockCitation]);
    (buildGraphContext as jest.Mock).mockResolvedValue(mockGraphContext);
    (AIFactory as jest.Mock).mockImplementation(() => ({
      buildKnowledgeGraphSource: jest.fn().mockResolvedValue({
        source: { chatCompletion: jest.fn() },
        model: { externalId: 'test-model' },
      }),
    }));
    (hybridEntitySearch as jest.Mock).mockResolvedValue([mockEntity]);
    (hybridConceptSearch as jest.Mock).mockResolvedValue([mockConcept]);
    (filterAnchorsForRelevance as jest.Mock).mockResolvedValue({
      entities: [mockEntity],
      concepts: [mockConcept],
      chunks: [mockCitation.citation],
    });
  });

  it('returns citations and graphContext', async () => {
    const result = await explanationQuery(params);
    expect(result.citations).toBeDefined();
    expect(result.graphContext).toEqual(mockGraphContext);
  });

  it('returns empty citations when embedding fails', async () => {
    (embedContent as jest.Mock).mockResolvedValue({ embeddings: [] });
    const result = await explanationQuery(params);
    expect(result.citations).toEqual([]);
    expect(result.graphContext).toBeUndefined();
  });

  it('uses hybrid search with term extraction in unscoped mode', async () => {
    await explanationQuery(params);
    expect(extractSearchTerms).toHaveBeenCalled();
    expect(hybridEntitySearch).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 10 }));
    expect(hybridConceptSearch).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 10 }));
  });

  it('passes extracted terms to hybrid search', async () => {
    (extractSearchTerms as jest.Mock).mockResolvedValue({ terms: ['GenAI', 'LLM'] });
    await explanationQuery(params);
    expect(hybridEntitySearch).toHaveBeenCalledWith(expect.objectContaining({
      extractedTerms: ['GenAI', 'LLM'],
    }));
  });

  describe('score-gap filtering', () => {
    it('filters noisy anchors before building graph context', async () => {
      const noisyEntities = [
        { ...mockEntity, id: 'e1', score: 0.70 },
        { ...mockEntity, id: 'e2', score: 0.65 },
        { ...mockEntity, id: 'e3', score: 0.10 }, // noise — 0.10/0.65 = 0.15 < 0.4
      ];
      (hybridEntitySearch as jest.Mock).mockResolvedValue(noisyEntities);
      (hybridConceptSearch as jest.Mock).mockResolvedValue([]);
      (filterAnchorsForRelevance as jest.Mock).mockImplementation(
        (_q: any, entities: any, concepts: any, _s: any, _m: any, chunks: any) => ({
          entities, concepts, chunks,
        })
      );

      await explanationQuery(params);

      // filterAnchorsForRelevance should receive only the 2 non-noise entities
      const entityArg = (filterAnchorsForRelevance as jest.Mock).mock.calls[0][1];
      expect(entityArg).toHaveLength(2);
      expect(entityArg.map((e: any) => e.id)).toEqual(['e1', 'e2']);
    });
  });

  describe('error handling', () => {
    it('returns citations even if graph context fails', async () => {
      (buildGraphContext as jest.Mock).mockRejectedValue(new Error('Neo4j down'));
      const result = await explanationQuery(params);
      expect(result.citations).toBeDefined();
      expect(result.graphContext).toBeUndefined();
    });
  });
});
