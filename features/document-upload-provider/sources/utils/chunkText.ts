import { get_encoding } from 'tiktoken';

import logger from '@/server/logger';
import { TextChunk } from '@/features/document-upload-provider/sources/types';

// Encoding for OpenAI's text-embedding-3-* models
const encoding = get_encoding('cl100k_base');

export interface ChunkTextParams {
  text: string;
  maxTokens?: number;
  overlapTokens?: number;
}

export async function chunkText(params: ChunkTextParams): Promise<TextChunk[]> {
  const { text, maxTokens = 7000, overlapTokens = 500 } = params;

  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided to chunkText');
    return [];
  }

  try {
    const chunks: TextChunk[] = [];

    // Split text into sentences for better chunk boundaries
    const sentences = text
      .split(/([.!?]+)/)
      .reduce((acc, part, index, array) => {
        if (index % 2 === 0 && part.trim()) {
          // This is sentence content
          const punctuation = array[index + 1] || '';
          const fullSentence = part.trim() + punctuation;
          if (fullSentence.trim().length > 0) {
            acc.push(fullSentence);
          }
        }
        return acc;
      }, [] as string[]);

    if (sentences.length === 0) {
      logger.warn('No sentences found in text after splitting');
      return [];
    }

    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = encoding.encode(sentence).length;

      // If this single sentence exceeds maxTokens, we need to force it into a chunk
      if (sentenceTokens > maxTokens) {
        // If we have a current chunk, save it first
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            tokenCount: currentTokens,
          });
          currentChunk = '';
          currentTokens = 0;
        }

        // Add the oversized sentence as its own chunk
        chunks.push({
          content: sentence,
          index: chunkIndex++,
          tokenCount: sentenceTokens,
        });

        continue;
      }

      // If adding this sentence would exceed max tokens and we have content
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.trim()) {
        // Save current chunk
        const chunkContent = currentChunk.trim();
        chunks.push({
          content: chunkContent,
          index: chunkIndex++,
          tokenCount: currentTokens,
        });

        logger.debug(`Created chunk ${chunkIndex - 1} with ${currentTokens} tokens`);

        // Start new chunk with overlap if specified
        if (overlapTokens > 0 && chunks.length > 0) {
          // Try to include some overlap from the previous chunk
          const overlapWords = getOverlapWords(chunkContent, overlapTokens);
          currentChunk = overlapWords ? overlapWords + ' ' + sentence : sentence;
          currentTokens = encoding.encode(currentChunk).length;
        } else {
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        }
      } else {
        // Add sentence to current chunk, but check if it would exceed limit
        const testChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
        const testTokens = encoding.encode(testChunk).length;

        if (testTokens <= maxTokens) {
          currentChunk = testChunk;
          currentTokens = testTokens;
        } else {
          // Current chunk + this sentence would exceed limit
          // Save current chunk first if it has content
          if (currentChunk.trim()) {
            chunks.push({
              content: currentChunk.trim(),
              index: chunkIndex++,
              tokenCount: currentTokens,
            });
          }

          // Start new chunk with this sentence
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: currentTokens,
      });

      logger.debug(`Created final chunk ${chunkIndex} with ${currentTokens} tokens`);
    }

    logger.info(`Successfully created ${chunks.length} chunks from text (${encoding.encode(text).length} total tokens)`);

    return chunks;

  } catch (error) {
    logger.error('Error in chunkText:', error);
    throw new Error(`Text chunking failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to get overlap words from the end of a chunk
 * This ensures context continuity between chunks
 */
function getOverlapWords(text: string, maxOverlapTokens: number): string {
  const words = text.split(' ');
  let overlapText = '';
  let tokenCount;

  for (let i = words.length - 1; i >= 0; i--) {
    const testText = words.slice(i).join(' ');
    const testTokens = encoding.encode(testText).length;

    if (testTokens <= maxOverlapTokens) {
      overlapText = testText;
      tokenCount = testTokens;
    } else {
      break;
    }
  }

  return overlapText;
}
