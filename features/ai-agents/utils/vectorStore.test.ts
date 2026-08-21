import { VectorStore } from '@/features/ai-agents/utils/vectorStore';
import { TextNode } from '@/features/ai-agents/utils/textChunker';
import logger from '@/server/logger';

jest.mock('compute-cosine-similarity', () =>
  jest.fn((a: number[], b: number[]) => {
    if (a[0] === b[0]) {
      return 0.1;
    }
  })
);

const createTestNode = (
  id: string,
  embedding: number[],
  metadata = {}
): TextNode => ({
  id,
  text: `Text content for ${id}`,
  embedding,
  metadata,
});

describe('VectorStore', () => {
  let vectorStore: VectorStore;

  beforeEach(() => {
    jest.clearAllMocks();
    vectorStore = new VectorStore();
  });

  describe('addNode', () => {
    it('should add a node with embedding', () => {
      const node = createTestNode('test-1', [0.1, 0.2, 0.3]);

      vectorStore.addNode(node);

      expect(vectorStore.getNodes()).toHaveLength(1);
      expect(vectorStore.getNodes()[0]).toBe(node);
    });

    it('should ignore nodes without embeddings', () => {
      const node: TextNode = {
        id: 'test-1',
        text: 'No embedding',
      };

      vectorStore.addNode(node);

      expect(vectorStore.getNodes()).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing embedding')
      );
    });
  });

  describe('findSimilarNodes', () => {
    beforeEach(() => {
      vectorStore.addNode(createTestNode('node-1', [0.1, 0.2, 0.3]));
      vectorStore.addNode(createTestNode('node-2', [0.2, 0.3, 0.4]));
      vectorStore.addNode(createTestNode('node-3', [0.3, 0.4, 0.5]));
      vectorStore.addNode(
        createTestNode('node-4', [0.1, 0.2, 0.3], {
          semanticSource: 'legal-block',
        })
      );
      vectorStore.addNode(
        createTestNode('node-5', [0.2, 0.3, 0.4], {
          semanticSource: 'likely-footer',
        })
      );
    });

    it('should find similar nodes based on embedding', () => {
      const queryEmbedding = [0.1, 0.2, 0.3];

      const results = vectorStore.findSimilarNodes(queryEmbedding);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((node) => node.id === 'node-1')).toBe(true);
      expect(results.some((node) => node.id === 'node-4')).toBe(true);
    });

    it('should limit results by topK parameter', () => {
      const queryEmbedding = [0.1, 0.2, 0.3];

      const results = vectorStore.findSimilarNodes(queryEmbedding, '', 1);

      expect(results).toHaveLength(1);
    });

    it('should boost certain content types', () => {
      const footerNode = createTestNode('node-footer', [0.2, 0.3, 0.4], {
        semanticSource: 'likely-footer',
      });
      const legalNode = createTestNode('node-legal', [0.2, 0.3, 0.4], {
        semanticSource: 'legal-block',
      });
      const regularNode = createTestNode('node-regular', [0.2, 0.3, 0.4], {
        semanticSource: 'body',
      });

      const testStore = new VectorStore();
      testStore.addNode(footerNode);
      testStore.addNode(legalNode);
      testStore.addNode(regularNode);

      const queryEmbedding = [0.2, 0.3, 0.4];

      (require('compute-cosine-similarity') as jest.Mock).mockReturnValue(0.95);

      const results = testStore.findSimilarNodes(queryEmbedding);

      expect(results.length).toBe(3);
      expect(results[0].id).toBe('node-footer');
      expect(results[1].id).toBe('node-legal');
      expect(results[2].id).toBe('node-regular');
    });
  });

  describe('getStats', () => {
    it('should return the correct node count', () => {
      vectorStore.addNode(createTestNode('node-1', [0.1, 0.2, 0.3]));
      vectorStore.addNode(createTestNode('node-2', [0.2, 0.3, 0.4]));

      const stats = vectorStore.getStats();

      expect(stats.totalNodes).toBe(2);
    });
  });
});
