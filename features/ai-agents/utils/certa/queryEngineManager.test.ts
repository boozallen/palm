import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { AiFactoryEmbeddingsAdapter } from '@/features/ai-agents/utils/aiFactoryEmbeddingsAdapter';
import { QueryEngineManager } from '@/features/ai-agents/utils/certa/queryEngineManager';

jest.mock('../textChunker', () => ({
  TextChunker: jest.fn().mockImplementation(() => ({
    processDocument: jest.fn(() => [
      {
        id: 'test-chunk-1',
        text: 'Chunk content',
        metadata: { semanticSource: 'body' },
      },
    ]),
  })),
}));

jest.mock('../aiFactoryCompletionAdapter', () => ({
  AiFactoryCompletionAdapter: jest.fn().mockImplementation(() => ({
    complete: jest.fn(async () => ({ text: 'Completion response' })),
  })),
}));

jest.mock('../aiFactoryEmbeddingsAdapter', () => ({
  AiFactoryEmbeddingsAdapter: jest.fn().mockImplementation(() => ({
    getEmbeddings: jest.fn(async () => [[0.1, 0.2, 0.3]]),
    getQueryEmbedding: jest.fn(async () => [0.1, 0.2, 0.3]),
  })),
}));

const createTestDoc = (id = 'test-doc') => ({
  id,
  text: '<html><body>Test content</body></html>',
  metadata: { url: `https://example.com/${id}` },
});

describe('QueryEngineManager', () => {
  let manager: QueryEngineManager;
  let completionAdapter: AiFactoryCompletionAdapter;
  let embeddingsAdapter: AiFactoryEmbeddingsAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    completionAdapter = new (AiFactoryCompletionAdapter as any)();
    embeddingsAdapter = new (AiFactoryEmbeddingsAdapter as any)();
    manager = new QueryEngineManager(completionAdapter, embeddingsAdapter);
  });

  describe('addDocuments', () => {
    it('should process and add documents', async () => {
      const docs = [createTestDoc('doc1'), createTestDoc('doc2')];
      
      await manager.addDocuments(docs);
      
      expect(embeddingsAdapter.getEmbeddings).toHaveBeenCalled();
    });

    it('should process documents in batches', async () => {
      const docs = [
        createTestDoc('doc1'), 
        createTestDoc('doc2'), 
        createTestDoc('doc3'),
      ];
      
      await manager.addDocuments(docs, 2); 
      
      expect(embeddingsAdapter.getEmbeddings).toHaveBeenCalledTimes(2);
    });
  });

  describe('runQuery', () => {
    it('should return a valid response', async () => {
      await manager.addDocuments([createTestDoc()]);

      const mockVectorStore = (manager as any).vectorStore;
      mockVectorStore.findSimilarNodes = jest.fn().mockReturnValue([
        {
          id: 'chunk-1',
          text: 'Content long enough to be included in results',
          metadata: { url: 'https://example.com' },
        },
      ]);
      
      const result = await manager.runQuery('test query');
      
      expect(result).toBeDefined();
      expect(result.response).toBe('Completion response');
      expect(embeddingsAdapter.getQueryEmbedding).toHaveBeenCalledWith('test query');
      expect(completionAdapter.complete).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const mockVectorStore = (manager as any).vectorStore;
      mockVectorStore.findSimilarNodes = jest.fn().mockReturnValue([]);
      
      const result = await manager.runQuery('test query');
      
      expect(result.response).toContain('does not contain sufficient content');
      expect(completionAdapter.complete).not.toHaveBeenCalled();
    });

    it('should handle content injection', async () => {
  
      const mockVectorStore = (manager as any).vectorStore;
      mockVectorStore.findSimilarNodes = jest.fn().mockReturnValue([
        {
          id: 'chunk-1',
          text: 'Content long enough to be included in results',
          metadata: { url: 'https://example.com' },
        },
      ]);
      
      await manager.runQuery('Input Data: test POLICY: policy');
      
      const callArg = (completionAdapter.complete as jest.Mock).mock.calls[0][0];
      expect(callArg.prompt).toContain('WEBSITE CONTENT:');
      expect(callArg.prompt).toContain('Input Data:');
      expect(callArg.prompt).toContain('POLICY:');
    });
  });
});
