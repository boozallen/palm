/**
 * @jest-environment node
 */
jest.mock('@/server/config');
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { document: { findMany: jest.fn() } },
}));
jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('undici', () => ({
  Agent: jest.fn().mockImplementation(() => ({})),
  fetch: jest.fn(),
}));

import { getConfig } from '@/server/config';
import db from '@/server/db';
import { fetch as undiciFetch } from 'undici';
import { runAgenticChat } from './agenticChat';
import { MessageRole } from '@/features/chat/types/message';

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockFindMany = (db as unknown as { document: { findMany: jest.Mock } }).document.findMany;
const mockFetch = undiciFetch as jest.MockedFunction<typeof undiciFetch>;

function mockStreamResponse(state: Record<string, unknown>): void {
  const sseText = [
    `event: values\ndata: ${JSON.stringify({ state })}\n\n`,
    'event: done\ndata: {}\n\n',
  ].join('');
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
  mockFetch.mockResolvedValue({
    ok: true,
    body,
  } as unknown as Awaited<ReturnType<typeof undiciFetch>>);
}

function lastRequestBody(): { input: Record<string, unknown> } {
  const calls = mockFetch.mock.calls;
  const init = calls[calls.length - 1][1] as { body: string };
  return JSON.parse(init.body);
}

const baseParams = {
  userId: 'u1',
  modelId: 'm1',
  documentIds: [] as string[],
  messages: [{ role: MessageRole.User, content: 'hi' }],
};

describe('runAgenticChat — write-time citation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue({
      agentServices: { langgraphServiceUrl: 'http://lg:8000', internalApiKey: 'test-key' },
    } as unknown as ReturnType<typeof getConfig>);
    mockFindMany.mockResolvedValue([]);
  });

  it('parses state.handle_map into the result handleMap (E#, R#, and numeric Q# entries)', async () => {
    mockStreamResponse({
      final_text: 'The answer.',
      citations: [],
      graph_search_results: [],
      // The service is a pass-through; a numeric Q# entry must survive the widened HandleMap type.
      handle_map: { E1: 'node-1', R1: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' }, Q0: 0 },
    });

    const result = await runAgenticChat({ ...baseParams, useGraph: true, citeEvidence: true });

    expect(result.handleMap).toEqual({
      E1: 'node-1',
      R1: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' },
      Q0: 0,
    });
    expect(result.finalText).toBe('The answer.');
  });

  it('sends enabled citation and memory inputs when requested', async () => {
    mockStreamResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    await runAgenticChat({ ...baseParams, useGraph: true, citeEvidence: true, memoryEnabled: true });

    const { input } = lastRequestBody();
    expect(input.cite_evidence).toBe(true);
    expect(input.memory_enabled).toBe(true);
    expect(input.handle_map).toEqual({});
  });

  it('defaults handleMap to {} and citation and memory inputs to false when omitted', async () => {
    mockStreamResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    const result = await runAgenticChat(baseParams);

    expect(result.handleMap).toEqual({});
    expect(lastRequestBody().input.cite_evidence).toBe(false);
    expect(lastRequestBody().input.memory_enabled).toBe(false);
    expect(lastRequestBody().input.handle_map).toEqual({});
  });

  it('sends the selected user group so usage from this turn attributes to it', async () => {
    mockStreamResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    await runAgenticChat({ ...baseParams, userGroupId: 'group-1' });

    expect(lastRequestBody().input.user_group_id).toBe('group-1');
  });

  it('defaults user_group_id to an empty string when no group is selected', async () => {
    mockStreamResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    await runAgenticChat(baseParams);

    expect(lastRequestBody().input.user_group_id).toBe('');
  });
});

describe('runAgenticChat — onChunk streaming callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue({
      agentServices: { langgraphServiceUrl: 'http://lg:8000', internalApiKey: 'test-key' },
    } as unknown as ReturnType<typeof getConfig>);
    mockFindMany.mockResolvedValue([]);
  });

  it('calls onChunk for each content-block-delta received', async () => {
    const encoder = new TextEncoder();
    const sseText = [
      'event: content-block-delta\ndata: {"delta":{"text":"Hello"}}\n\n',
      'event: content-block-delta\ndata: {"delta":{"text":" world"}}\n\n',
      `event: values\ndata: ${JSON.stringify({ state: { final_text: 'Hello world', citations: [], graph_search_results: [] } })}\n\n`,
      'event: done\ndata: {}\n\n',
    ].join('');
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseText));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue({ ok: true, body } as unknown as Awaited<ReturnType<typeof undiciFetch>>);

    const onChunk = jest.fn().mockResolvedValue(undefined);
    await runAgenticChat({ ...baseParams, onChunk });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onChunk).toHaveBeenNthCalledWith(2, ' world');
  });

  it('does not call onChunk when there are no content-block-delta events', async () => {
    mockStreamResponse({ final_text: 'plain answer', citations: [], graph_search_results: [] });

    const onChunk = jest.fn().mockResolvedValue(undefined);
    await runAgenticChat({ ...baseParams, onChunk });

    expect(onChunk).not.toHaveBeenCalled();
  });

  it('does not error when onChunk is omitted', async () => {
    mockStreamResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    await expect(runAgenticChat(baseParams)).resolves.toBeDefined();
  });
});
