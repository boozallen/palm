import { logger } from '@/server/logger';
import { AIFactory } from '@/features/ai-provider';
import { TextChunk } from '@/features/document-upload-provider/sources/types';
import { GOVERNMENT_PURSUIT_SCHEMA_TYPES } from 'features/settings/types/graph-database';
import { DataProfile } from '@/features/shared/types/document';

// Cap the document sample so analysis stays cheap (~2-3k tokens) and never
// feeds the whole document to the LLM, regardless of document length.
const DOCUMENT_SAMPLE_CHAR_LIMIT = 8000;

function buildPrompt(documentSample: string, fileName: string): string {
  return `Based on the sample of the beginning and end of this document, return a valid JSON object with this exact structure:
    {
      "type": string | null,
      "date": string | null,
      "summary": string
    }

    ## document context
    - Filename: ${fileName}
    - Document sample: ${documentSample}

    Rules:
    - "type": Classify the document type. For government solicitations use: ${GOVERNMENT_PURSUIT_SCHEMA_TYPES.join(', ')}. For other documents, use "General". Use null only if classification is impossible.
    - "date": Extract the document's issue/effective/publication date in YYYY-MM-DD format. Use null if no date is found. Do NOT invent dates.
    - "summary": Provide a concise 1-2 sentence summary of the document's purpose and content based on the available sample.

    Return ONLY the JSON object — no markdown fences, no backticks, no additional text.
  `;
}

type Input = {
  documentId: string;
  chunks: TextChunk[];
  userId: string;
  userGroupId?: string;
  fileName: string;
};

type Result = {
  type: string | null;
  date: string | null;
  summary: string;
};

/**
 * Builds the document sample from the lowest-index chunks plus the last
 * chunk (which often carries signature/date information). Never the whole doc.
 */
function buildDocumentSample(chunks: TextChunk[]): string {
  if (chunks.length === 0) {
    return '';
  }

  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  const sample: string[] = [sorted[0].content];

  if (sorted.length > 1) {
    sample.push(sorted[1].content);
  }
  if (sorted.length > 2) {
    sample.push(sorted[sorted.length - 1].content);
  }

  return sample.join('\n\n---\n\n').slice(0, DOCUMENT_SAMPLE_CHAR_LIMIT);
}

/**
 * Samples the document (beginning + end), makes one LLM call to characterize it,
 * and returns the type / date / summary metadata slice for the caller to persist.
 */
export async function getMetadata({ documentId, chunks, userId, userGroupId, fileName }: Input): Promise<Pick<DataProfile, 'type' | 'date' | 'summary'> | null> {
  try {
    const documentSample = buildDocumentSample(chunks);
    if (!documentSample.trim()) {
      logger.warn(`[DOC-ANALYSIS] No content to analyze for ${documentId}`);
      return null;
    }

    const factory = new AIFactory({ userId, userGroupId });
    const { source, model } = await factory.buildSystemSource(undefined, {
      // Timeout prevents hung requests from pinning worker slots indefinitely.
      requestTimeoutMs: 30_000,
    });

    const prompt = buildPrompt(documentSample, fileName);

    const response = await source.completion(prompt, {
      model: model.externalId,
      temperature: 0.1,
      topP: 0.5,
    });

    let result: Result;
    try {
      const match = response.text.match(/\{[\s\S]*\}/);
      if (!match) {
        logger.warn(`[DOC-ANALYSIS] No JSON object in analysis response for ${documentId}`);
        return null;
      }
      const parsed = JSON.parse(match[0]);
      if (!('type' in parsed && 'date' in parsed && 'summary' in parsed)) {
        logger.warn(`[DOC-ANALYSIS] Missing required properties in analysis response for ${documentId}`);
        return null;
      }
      result = {
        type: parsed.type || null,
        date: parsed.date || null,
        summary: parsed.summary || '',
      };
    } catch (error) {
      logger.warn(`[DOC-ANALYSIS] Could not parse analysis response for ${documentId}`, error);
      return null;
    }

    logger.info(`[DOC-ANALYSIS] Analysis metadata fetched for ${documentId}`, {
      summary: result.summary,
      type: result.type,
      date: result.date,
    });

    return {
      ...(result.summary ? { summary: result.summary } : {}),
      ...(result.type ? { type: result.type } : {}),
      ...(result.date ? { date: result.date } : {}),
    };
  } catch (error) {
    logger.warn(`[DOC-ANALYSIS] Analysis threw for ${documentId}:`, error);
    return null;
  }
}
