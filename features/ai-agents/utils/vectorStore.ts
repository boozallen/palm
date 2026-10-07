import cosineSimilarity from 'compute-cosine-similarity';

import { TextNode } from '@/features/ai-agents/utils/textChunker';
import logger from '@/server/logger';

export class VectorStore {
  private readonly nodes: TextNode[] = [];

  constructor() {
    logger.debug('VectorStore initialized');
  }

  addNode(node: TextNode): void {
    if (!node.embedding) {
      logger.warn(`Node ${node.id} missing embedding`);
      return;
    }

    this.nodes.push(node);
  }

  getNodes(): TextNode[] {
    return this.nodes;
  }

  getStats(): Record<string, any> {
    return {
      totalNodes: this.nodes.length,
    };
  }

  findSimilarNodes(
    queryEmbedding: number[],
    _queryText = '',
    topK = 10
  ): TextNode[] {
    return this.nodes
      .filter((n) => n.embedding)
      .map((n) => {
        const score = cosineSimilarity(queryEmbedding, n.embedding!);
        const boost = this.scoreModifier(n);
        return { node: n, score: score * boost };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => r.node);
  }

  private scoreModifier(node: TextNode): number {
    const src = node.metadata?.semanticSource;
  
    if (src === 'likely-footer') {
      return 1.25;
    }
  
    if (src === 'legal-block') {
      return 1.15;
    }
  
    if (node.metadata?.navContent) {
      return 1.1;
    }
  
    return 1.0;
  }
  
}
