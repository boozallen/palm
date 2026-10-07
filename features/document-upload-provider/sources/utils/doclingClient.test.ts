jest.mock('undici', () => ({
  Agent: jest.fn(() => ({})),
}));
jest.mock('@/server/logger');
jest.mock('@/server/config', () => ({
  getConfig: jest.fn(() => ({
    agentServices: {
      doclingServiceUrl: 'https://docling.example.com',
      internalApiKey: 'k',
    },
  })),
}));

import {
  DoclingBusyError,
  DoclingUnrecoverableError,
  parseAndChunkWithDocling,
} from './doclingClient';
import logger from '@/server/logger';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const params = {
  buffer: Buffer.from('document contents'),
  contentType: 'application/pdf',
  fileName: 'document.pdf',
  maxTokens: 640,
};

function failedResponse(
  status: number,
  body: string,
  retryAfter?: string,
) {
  return {
    ok: false,
    status,
    headers: {
      get: (name: string) => name === 'Retry-After' ? retryAfter ?? null : null,
    },
    text: async () => body,
  };
}

async function getRejectedError(promise: Promise<unknown>): Promise<Error> {
  let caughtError: unknown;
  try {
    await promise;
  } catch (error) {
    caughtError = error;
  }

  if (!(caughtError instanceof Error)) {
    throw new Error('Expected promise to reject with an Error');
  }
  return caughtError;
}

describe('parseAndChunkWithDocling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts the document contract and maps the response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        chunks: [
          {
            content: 'Section\nBody',
            index: 0,
            token_count: 2,
            start_position: 9,
            end_position: 13,
            headings: ['Section', 'Subsection'],
            page_start: 2,
            page_end: 4,
          },
          {
            content: 'Body without headings',
            index: 1,
            token_count: 3,
            start_position: 15,
            end_position: 36,
            headings: [],
            page_start: null,
            page_end: null,
          },
        ],
        extracted_text: 'Section\n\nBody',
      }),
    });

    const result = await parseAndChunkWithDocling(params);

    expect(result).toEqual({
      chunks: [
        {
          content: 'Section\nBody',
          index: 0,
          tokenCount: 2,
          startPosition: 9,
          endPosition: 13,
          sectionPath: ['Section', 'Subsection'],
          pageStart: 2,
          pageEnd: 4,
        },
        {
          content: 'Body without headings',
          index: 1,
          tokenCount: 3,
          startPosition: 15,
          endPosition: 36,
          sectionPath: [],
          pageStart: null,
          pageEnd: null,
        },
      ],
      extractedText: 'Section\n\nBody',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://docling.example.com/parse-and-chunk',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer k',
        },
      }),
    );

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body as string)).toEqual({
      file_base64: params.buffer.toString('base64'),
      content_type: params.contentType,
      file_name: params.fileName,
      max_tokens: params.maxTokens,
    });
    expect(JSON.parse(options.body as string)).not.toHaveProperty('overlap_tokens');
  });

  it('throws a busy error using Retry-After seconds', async () => {
    mockFetch.mockResolvedValueOnce(
      failedResponse(503, 'sensitive service detail', '30'),
    );

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toBeInstanceOf(DoclingBusyError);
    expect(error.message).toBe('Document parsing service is busy');
    expect((error as DoclingBusyError).retryAfterMs).toBe(30_000);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it.each([
    ['a missing header', undefined],
    ['an invalid header', 'soon'],
  ])('uses the default retry delay for %s', async (_description, retryAfter) => {
    mockFetch.mockResolvedValueOnce(
      failedResponse(503, 'sensitive service detail', retryAfter),
    );

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toBeInstanceOf(DoclingBusyError);
    expect((error as DoclingBusyError).retryAfterMs).toBe(15_000);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('throws a sanitized unrecoverable error for HTTP 422', async () => {
    mockFetch.mockResolvedValueOnce(
      failedResponse(422, 'sensitive service detail'),
    );

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toBeInstanceOf(DoclingUnrecoverableError);
    expect(error.message).toBe('Document could not be parsed');
    expect(error.message).not.toContain('sensitive service detail');
    expect(error.message).not.toContain('422');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('422'));
  });

  it('throws an unrecoverable error when the request times out', async () => {
    const timeoutError = Object.assign(
      new Error('The operation was aborted'),
      { name: 'TimeoutError' },
    );
    mockFetch.mockRejectedValueOnce(timeoutError);

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toBeInstanceOf(DoclingUnrecoverableError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(params.fileName),
      timeoutError,
    );
  });

  it('throws a plain sanitized error for connection failures', async () => {
    const fetchError = new Error('connect ECONNREFUSED');
    mockFetch.mockRejectedValueOnce(fetchError);

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toEqual(new Error('Document parsing failed'));
    expect(error).not.toBeInstanceOf(DoclingBusyError);
    expect(error).not.toBeInstanceOf(DoclingUnrecoverableError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(params.fileName),
      fetchError,
    );
  });

  it('throws a plain sanitized error for other non-OK responses', async () => {
    mockFetch.mockResolvedValueOnce(
      failedResponse(500, 'sensitive service detail'),
    );

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toEqual(new Error('Document parsing failed'));
    expect(error).not.toBeInstanceOf(DoclingBusyError);
    expect(error).not.toBeInstanceOf(DoclingUnrecoverableError);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('500'));
  });

  it('throws a plain sanitized error for malformed JSON', async () => {
    const jsonError = new SyntaxError('Unexpected token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw jsonError;
      },
    });

    const error = await getRejectedError(parseAndChunkWithDocling(params));

    expect(error).toEqual(new Error('Document parsing failed'));
    expect(error).not.toBeInstanceOf(DoclingBusyError);
    expect(error).not.toBeInstanceOf(DoclingUnrecoverableError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(params.fileName),
      jsonError,
    );
  });
});
