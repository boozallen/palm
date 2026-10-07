import { TextChunk } from '@/features/document-upload-provider/sources/types';
import { getConfig } from '@/server/config';
import logger from '@/server/logger';
interface DoclingChunk {
  content: string;
  index: number;
  token_count: number;
  // UTF-16 offsets into extracted_text (JavaScript string indices).
  start_position: number;
  end_position: number;
  headings: string[];
  page_start: number | null;
  page_end: number | null;
}

interface DoclingResponse {
  chunks: DoclingChunk[];
  extracted_text: string;
}

// Sized from parse time, not from any queue setting: the CPU pipeline runs at roughly a
// second per page and scanned pages are slower, so this covers several hundred pages.
// Longer documents fail here, loudly, rather than hang.
const DOCLING_PARSE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_BUSY_RETRY_AFTER_MS = 15_000;
const PARSING_FAILED_MESSAGE = 'Document parsing failed';

// Node's built-in fetch (undici) has a default headersTimeout of 300s that fires before
// AbortSignal.timeout, making any timeout above 5 minutes dead code.
// Lazy-loaded so the undici import doesn't break Jest (TextEncoder not defined).
let _dispatcher: InstanceType<typeof import('undici').Agent> | undefined;
function getDispatcher() {
  if (!_dispatcher) {
    const { Agent } = require('undici') as typeof import('undici');
    _dispatcher = new Agent({
      headersTimeout: DOCLING_PARSE_TIMEOUT_MS,
      bodyTimeout: DOCLING_PARSE_TIMEOUT_MS,
    });
  }
  return _dispatcher;
}

export class DoclingBusyError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('Document parsing service is busy');
    this.name = 'DoclingBusyError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class DoclingUnrecoverableError extends Error {
  constructor() {
    super('Document could not be parsed');
    this.name = 'DoclingUnrecoverableError';
  }
}

function getBusyRetryAfterMs(response: Response): number {
  const headerValue = response.headers.get('Retry-After')?.trim();
  if (!headerValue || !/^[0-9]+$/.test(headerValue)) {
    return DEFAULT_BUSY_RETRY_AFTER_MS;
  }

  const retryAfterMs = Number(headerValue) * 1000;
  return Number.isSafeInteger(retryAfterMs) && retryAfterMs > 0
    ? retryAfterMs
    : DEFAULT_BUSY_RETRY_AFTER_MS;
}

export async function parseAndChunkWithDocling(params: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  maxTokens?: number;
}): Promise<{ chunks: TextChunk[]; extractedText: string }> {
  const { buffer, contentType, fileName, maxTokens = 800 } = params;
  const { doclingServiceUrl, internalApiKey } = getConfig().agentServices;

  let response: Response;
  try {
    response = await fetch(`${doclingServiceUrl}/parse-and-chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalApiKey}`,
      },
      body: JSON.stringify({
        file_base64: buffer.toString('base64'),
        content_type: contentType,
        file_name: fileName,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(DOCLING_PARSE_TIMEOUT_MS),
      // @ts-expect-error Node's undici-backed fetch supports dispatcher but RequestInit lacks the type
      dispatcher: getDispatcher(),
    });
  } catch (error) {
    logger.error(`[DOCLING] parse-and-chunk threw for ${fileName}:`, error);
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new DoclingUnrecoverableError();
    }
    throw new Error(PARSING_FAILED_MESSAGE);
  }

  if (!response.ok) {
    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (error) {
      logger.error(
        `[DOCLING] Could not read failed response for ${fileName}:`,
        error,
      );
    }
    logger.error(
      `[DOCLING] parse-and-chunk failed for ${fileName} with HTTP ${response.status}: ${responseBody}`,
    );
    if (response.status === 503) {
      throw new DoclingBusyError(getBusyRetryAfterMs(response));
    }
    if (response.status === 422) {
      throw new DoclingUnrecoverableError();
    }
    throw new Error(PARSING_FAILED_MESSAGE);
  }

  try {
    const data = await response.json() as DoclingResponse;
    const chunks: TextChunk[] = data.chunks.map((chunk) => ({
      content: chunk.content,
      index: chunk.index,
      tokenCount: chunk.token_count,
      startPosition: chunk.start_position,
      endPosition: chunk.end_position,
      sectionPath: chunk.headings,
      pageStart: chunk.page_start,
      pageEnd: chunk.page_end,
    }));

    return { chunks, extractedText: data.extracted_text };
  } catch (error) {
    logger.error(`[DOCLING] Invalid response for ${fileName}:`, error);
    throw new Error(PARSING_FAILED_MESSAGE);
  }
}
