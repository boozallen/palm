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

function mockThreadsResponse(state: Record<string, unknown>): void {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'completed', state }),
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
    mockThreadsResponse({
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

  it('always sends handle_map: {} and sends cite_evidence=true when citeEvidence is true', async () => {
    mockThreadsResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    await runAgenticChat({ ...baseParams, useGraph: true, citeEvidence: true });

    const { input } = lastRequestBody();
    expect(input.cite_evidence).toBe(true);
    expect(input.handle_map).toEqual({});
  });

  it('defaults handleMap to {} and cite_evidence to false when omitted', async () => {
    mockThreadsResponse({ final_text: 'x', citations: [], graph_search_results: [] });

    const result = await runAgenticChat(baseParams);

    expect(result.handleMap).toEqual({});
    expect(lastRequestBody().input.cite_evidence).toBe(false);
    expect(lastRequestBody().input.handle_map).toEqual({});
  });
});
