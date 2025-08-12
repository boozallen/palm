import { AiSettings } from '@/types/ai-settings';
import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import logger from '@/server/logger';

/**
 * Interface to define embedding methods
 */
export interface EmbeddingInterface {
  getTextEmbedding(text: string): Promise<number[]>;
  getQueryEmbedding(query: string): Promise<number[]>;
  getEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * AI Factory Embeddings Adapter 
 */
export class AiFactoryEmbeddingsAdapter implements EmbeddingInterface {
  constructor(
    private readonly ai: BuildResult,
    private readonly settings: Omit<AiSettings, 'model'> = {
      randomness: 0.0,
      repetitiveness: 1,
      bestOf: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    }
  ) {}

  /**
   * Get embedding for a single text
   */
  async getTextEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ai.source.createEmbeddings([text], {
        ...this.settings,
        model: this.ai.model.externalId,
      });
      return response.embeddings![0].embedding;
    }
    catch (error) {
      logger.error('Failed to create embeddings: ', error);
      throw new Error('Error creating text embedding');
    }
  }

  /**
   * Get embedding for a query 
   */
  async getQueryEmbedding(query: string): Promise<number[]> {
    // For most embedding models, query embedding is the same as text embedding
    return this.getTextEmbedding(query);
  }

  /**
   * Get embeddings for multiple texts
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (texts.length === 0) {
        return [];
      }

      const response = await this.ai.source.createEmbeddings(texts, {
        ...this.settings,
        model: this.ai.model.externalId,
      });

      if (!response.embeddings) {
        throw new Error('No embeddings returned from API');
      }

      return response.embeddings.map(e => e.embedding);
    }
    catch (error) {
      logger.error('Failed to create multiple embeddings: ', error);
      throw new Error('Error creating embeddings for multiple texts');
    }
  }
}
