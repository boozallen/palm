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

/**
 * Split text into sentences using Intl.Segmenter for better boundary detection.
 * Properly handles decimals (42.1), abbreviations (U.S., Inc.), etc.
 * Returns each sentence with its start/end position in the original text,
 * enabling citation mapping back to the source document.
 */
function splitIntoSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const sentences: Array<{ text: string; start: number; end: number }> = [];

  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const segments = segmenter.segment(text);

    for (const segment of segments) {
      const sentenceText = segment.segment;
      const trimmedText = sentenceText.trim();
      if (trimmedText.length > 0) {
        // Find actual start position (skip leading whitespace)
        const leadingWhitespace = sentenceText.length - sentenceText.trimStart().length;
        sentences.push({
          text: trimmedText,
          start: segment.index + leadingWhitespace,
          end: segment.index + leadingWhitespace + trimmedText.length,
        });
      }
    }
  } catch (error) {
    logger.error('Error in Intl.Segmenter, falling back to basic split:', error);
    // Fallback: treat entire text as one sentence
    if (text.trim().length > 0) {
      sentences.push({
        text: text,
        start: 0,
        end: text.length,
      });
    }
  }

  return sentences;
}

export async function chunkText(params: ChunkTextParams): Promise<TextChunk[]> {
  const { text, maxTokens = 800, overlapTokens = 150 } = params;

  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided to chunkText');
    return [];
  }

  try {
    const chunks: TextChunk[] = [];

    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      logger.warn('No sentences found in text after splitting');
      return [];
    }

    let currentChunk = '';
    let currentChunkStart = 0;
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const { text: sentence, start: sentenceStart, end: sentenceEnd } of sentences) {
      const sentenceTokens = encoding.encode(sentence).length;

      // If this single sentence exceeds maxTokens, we need to force it into a chunk
      if (sentenceTokens > maxTokens) {
        // If we have a current chunk, save it first
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            tokenCount: currentTokens,
            startPosition: currentChunkStart,
            endPosition: currentChunkStart + currentChunk.length,
          });
          currentChunk = '';
          currentTokens = 0;
        }

        // Add the oversized sentence as its own chunk
        chunks.push({
          content: sentence,
          index: chunkIndex++,
          tokenCount: sentenceTokens,
          startPosition: sentenceStart,
          endPosition: sentenceEnd,
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
          startPosition: currentChunkStart,
          endPosition: currentChunkStart + currentChunk.length,
        });

        logger.debug(`Created chunk ${chunkIndex - 1} with ${currentTokens} tokens`);

        // Start new chunk with overlap if specified
        if (overlapTokens > 0 && chunks.length > 0) {
          const overlapResult = getOverlapWithPosition(chunkContent, overlapTokens, currentChunkStart);
          currentChunk = overlapResult.text + ' ' + sentence;
          currentChunkStart = overlapResult.startPosition;
          currentTokens = encoding.encode(currentChunk).length;
        } else {
          currentChunk = sentence;
          currentChunkStart = sentenceStart;
          currentTokens = sentenceTokens;
        }
      } else {
        // Add sentence to current chunk
        if (currentChunk === '') {
          currentChunk = sentence;
          currentChunkStart = sentenceStart;
          currentTokens = sentenceTokens;
        } else {
          currentChunk += ' ' + sentence;
          currentTokens = encoding.encode(currentChunk).length;
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: currentTokens,
        startPosition: currentChunkStart,
        endPosition: currentChunkStart + currentChunk.length,
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

// Helper function to get overlap words from the end of a chunk with position tracking.
// Ensures context continuity between chunks while preserving position information for citation mapping.
function getOverlapWithPosition(
  text: string,
  maxOverlapTokens: number,
  chunkStartPos: number
): { text: string; startPosition: number } {
  const words = text.split(' ');
  let overlapText = '';
  let overlapStartOffset = 0;

  for (let i = words.length - 1; i >= 0; i--) {
    const testText = words.slice(i).join(' ');
    const testTokens = encoding.encode(testText).length;

    if (testTokens <= maxOverlapTokens) {
      overlapText = testText;
      // Calculate how many characters from the start this overlap begins
      overlapStartOffset = words.slice(0, i).join(' ').length + (i > 0 ? 1 : 0);
    } else {
      break;
    }
  }

  return {
    text: overlapText,
    startPosition: chunkStartPos + overlapStartOffset,
  };
}
