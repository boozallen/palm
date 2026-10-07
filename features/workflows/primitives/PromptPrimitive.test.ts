/**
 * Unit tests for PromptPrimitive - document context scoping
 *
 * Core behavior under test:
 * Documents should only appear in the LLM prompt when the immediate predecessor
 * node outputs them (i.e., there is a direct edge from a document_input to this node).
 * Documents that exist elsewhere in state but are not the direct input must NOT appear.
 */

import { PromptPrimitive } from '@/features/workflows/primitives/PromptPrimitive';
import { PrimitiveContext } from '@/features/workflows/types/primitive';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';

jest.mock('@/features/ai-agents/utils/aiFactoryCompletionAdapter');
jest.mock('@/features/chat/utils/chatContextHelpers');
jest.mock('@/features/chat/knowledge-bases/addContextToMessage');
jest.mock('@/features/shared/dal/getUserGraphDatabaseAccess');
jest.mock('@/features/chat/dal/formatGraphContext');

const mockComplete = jest.fn();
const mockChat = jest.fn();
const mockProcessDocuments = jest.fn();
const mockAddContextToMessage = jest.fn();
const mockGetUserGraphDatabaseAccess = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockComplete.mockResolvedValue({ text: 'mock response' });
  mockChat.mockResolvedValue({ message: { content: 'mock response' } });
  (AiFactoryCompletionAdapter as jest.Mock).mockImplementation(() => ({
    complete: mockComplete,
    chat: mockChat,
  }));
  
  // Mock RAG functions - return empty by default
  mockProcessDocuments.mockResolvedValue({ citations: [], graphContext: undefined });
  mockAddContextToMessage.mockReturnValue('');
  mockGetUserGraphDatabaseAccess.mockResolvedValue(false);
  
  const { processDocuments } = require('@/features/chat/utils/chatContextHelpers');
  const addContextToMessage = require('@/features/chat/knowledge-bases/addContextToMessage').default;
  const getUserGraphDatabaseAccess = require('@/features/shared/dal/getUserGraphDatabaseAccess').default;
  
  processDocuments.mockImplementation(mockProcessDocuments);
  addContextToMessage.mockImplementation(mockAddContextToMessage);
  getUserGraphDatabaseAccess.mockImplementation(mockGetUserGraphDatabaseAccess);
});

// Helpers

const makeContext = (
  input: Record<string, unknown>,
  state: Record<string, unknown> = {},
): PrimitiveContext => ({
  input: input as Record<string, never>,
  state: state as Record<string, never>,
  workflowId: 'wf-1',
  executionId: 'ex-1',
  userId: 'user-1',
});

const makePrimitive = (prompt = 'Summarize the content.', configOverrides: Record<string, unknown> = {}) =>
  new PromptPrimitive(
    {
      id: 'step-llm',
      name: 'LLM Step',
      config: { model: 'claude-sonnet-4-6', prompt, ...configOverrides },
    },
    {} as never, // mock AI instance — real value is unused since adapter is mocked
  );

const getCapturedPrompt = (): string => {
  if (mockComplete.mock.calls.length > 0) {
    return mockComplete.mock.calls[0][0].prompt as string;
  }
  // system message path uses chat()
  const messages = mockChat.mock.calls[0][0].messages as Array<{ role: string; content: string }>;
  return messages.find((m) => m.role === 'user')?.content ?? '';
};

// Scenarios

describe('PromptPrimitive document context scoping', () => {
  it('includes documents when the immediate predecessor outputs them (direct edge)', async () => {
    // Reset mocks for this test
    jest.resetAllMocks();
    mockComplete.mockResolvedValue({ text: 'mock response' });
    (AiFactoryCompletionAdapter as jest.Mock).mockImplementation(() => ({
      complete: mockComplete,
      chat: mockChat,
    }));

    // Setup RAG mocks to return simulated document context
    mockProcessDocuments.mockResolvedValue({
      citations: [{ citation: 'Annual revenue was $5M.', sourceLabel: 'report.txt' }],
      graphContext: undefined,
    });
    mockAddContextToMessage.mockReturnValue('You have access to 1 file:\nreport.txt\n\n[Documents:]\nFile: report.txt\nAnnual revenue was $5M.');
    mockGetUserGraphDatabaseAccess.mockResolvedValue(false);

    const { processDocuments } = require('@/features/chat/utils/chatContextHelpers');
    const addContextToMessage = require('@/features/chat/knowledge-bases/addContextToMessage').default;
    const getUserGraphDatabaseAccess = require('@/features/shared/dal/getUserGraphDatabaseAccess').default;

    processDocuments.mockImplementation(mockProcessDocuments);
    addContextToMessage.mockImplementation(mockAddContextToMessage);
    getUserGraphDatabaseAccess.mockImplementation(mockGetUserGraphDatabaseAccess);

    const primitive = makePrimitive();
    const context = makeContext({
      documents: [{ id: 'doc1', name: 'report.txt', content: 'Annual revenue was $5M.' }],
    });

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).toContain('You have access to 1 file');
    expect(prompt).toContain('[Documents:]');
    expect(prompt).toContain('report.txt');
    expect(prompt).toContain('Annual revenue was $5M.');
  });

  it('does not include documents when they are only in state and not the direct input', async () => {
    // Simulates: DocInput → SomeOtherStep → LLM
    // DocInput output lives in state but LLM's direct predecessor is SomeOtherStep
    const primitive = makePrimitive();
    const context = makeContext(
      { response: 'Intermediate output from another step.' },
      {
        'doc-step': { documents: [{ name: 'report.txt', content: 'Annual revenue was $5M.' }] },
      },
    );

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).not.toContain('[Documents:]');
    expect(prompt).not.toContain('Annual revenue was $5M.');
  });

  it('includes the previous LLM response when directly chained (no documents)', async () => {
    // Simulates: DocInput → LLM1 → LLM2
    // LLM2 should see LLM1's response but NOT the original documents
    const primitive = makePrimitive('Now write a final report.');
    const context = makeContext(
      { response: 'Analysis: revenue grew 20% YoY.' },
      {
        'doc-step': { documents: [{ name: 'file.txt', content: 'raw doc content' }] },
        'llm-step-1': { response: 'Analysis: revenue grew 20% YoY.' },
      },
    );

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).toContain('Analysis: revenue grew 20% YoY.');
    expect(prompt).not.toContain('[Documents:]');
    expect(prompt).not.toContain('raw doc content');
  });

  it('includes both documents and the configured prompt when directly connected', async () => {
    // Reset mocks for this test
    jest.resetAllMocks();
    mockComplete.mockResolvedValue({ text: 'mock response' });
    (AiFactoryCompletionAdapter as jest.Mock).mockImplementation(() => ({
      complete: mockComplete,
      chat: mockChat,
    }));

    // Setup RAG mocks to return simulated document context
    mockProcessDocuments.mockResolvedValue({
      citations: [{ citation: 'Q3 targets were met.', sourceLabel: 'notes.txt' }],
      graphContext: undefined,
    });
    mockAddContextToMessage.mockReturnValue('You have access to 1 file:\nnotes.txt\n\nWhat are the key takeaways?\n\n[Documents:]\nFile: notes.txt\nQ3 targets were met.');
    mockGetUserGraphDatabaseAccess.mockResolvedValue(false);

    const { processDocuments } = require('@/features/chat/utils/chatContextHelpers');
    const addContextToMessage = require('@/features/chat/knowledge-bases/addContextToMessage').default;
    const getUserGraphDatabaseAccess = require('@/features/shared/dal/getUserGraphDatabaseAccess').default;

    processDocuments.mockImplementation(mockProcessDocuments);
    addContextToMessage.mockImplementation(mockAddContextToMessage);
    getUserGraphDatabaseAccess.mockImplementation(mockGetUserGraphDatabaseAccess);

    const primitive = makePrimitive('What are the key takeaways?');
    const context = makeContext({
      documents: [{ id: 'doc1', name: 'notes.txt', content: 'Q3 targets were met.' }],
    });

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).toContain('You have access to 1 file');
    expect(prompt).toContain('[Documents:]');
    expect(prompt).toContain('Q3 targets were met.');
    expect(prompt).toContain('What are the key takeaways?');
  });

  it('produces only the configured prompt when there is no prior context', async () => {
    const primitive = makePrimitive('What is the capital of France?');
    const context = makeContext({});

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).toBe('What is the capital of France?');
  });

  it('handles document from a single parent node', async () => {
    mockProcessDocuments.mockResolvedValue({
      citations: [{ citation: 'Q1 revenue: $1M.', sourceLabel: 'report.txt' }],
      graphContext: undefined,
    });
    mockAddContextToMessage.mockReturnValue('You have access to 1 file:\nreport.txt\n\n[Documents:]\nFile: report.txt\nQ1 revenue: $1M.\n\nAnalyze this document.');

    const primitive = makePrimitive('Analyze this document.');
    const context = makeContext({
      documents: [{ id: 'doc1', name: 'report.txt', content: 'Q1 revenue: $1M.' }],
    });

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).toContain('You have access to 1 file');
    expect(prompt).toContain('report.txt');
    expect(prompt).toContain('Q1 revenue: $1M.');
    expect(prompt).toContain('Analyze this document.');
  });

  it('handles documents from multiple parent nodes', async () => {
    mockProcessDocuments.mockResolvedValue({
      citations: [
        { citation: 'Sales data from Q1.', sourceLabel: 'sales.txt' },
        { citation: 'Marketing metrics overview.', sourceLabel: 'marketing.txt' },
      ],
      graphContext: undefined,
    });
    mockAddContextToMessage.mockReturnValue('You have access to 2 files:\nsales.txt\nmarketing.txt\n\n[Documents:]\nFile: sales.txt\nSales data from Q1.\nFile: marketing.txt\nMarketing metrics overview.\n\nAnalyze both data sources.');

    const primitive = makePrimitive('Analyze both data sources.');

    // Simulates multiple parent nodes each contributing one document
    // This would happen when multiple document nodes feed into the same LLM node
    const context = makeContext({
      documents: [
        { id: 'doc1', name: 'sales.txt', content: 'Sales data from Q1.' },
        { id: 'doc2', name: 'marketing.txt', content: 'Marketing metrics overview.' },
      ],
    });

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).toContain('You have access to 2 files');
    expect(prompt).toContain('sales.txt');
    expect(prompt).toContain('Sales data from Q1.');
    expect(prompt).toContain('marketing.txt');
    expect(prompt).toContain('Marketing metrics overview.');
    expect(prompt).toContain('Analyze both data sources.');
  });

  it('does not add document context section when documents lack names', async () => {
    mockProcessDocuments.mockResolvedValue({
      citations: [{ citation: 'Some content.', sourceLabel: 'unknown' }],
      graphContext: undefined,
    });
    mockAddContextToMessage.mockReturnValue('[Documents:]\nSome content.');

    const primitive = makePrimitive('Summarize the content.');
    const context = makeContext({
      documents: [{ id: 'doc1', content: 'Some content.' }],
    });

    await primitive.execute(context);

    const prompt = getCapturedPrompt();
    expect(prompt).not.toContain('You have access to');
    expect(prompt).toContain('[Documents:]');
  });
});

describe('PromptPrimitive citation and graphAnchor output', () => {
  it('includes citations and graphAnchors in success result when documents are processed', async () => {
    mockProcessDocuments.mockResolvedValue({
      citations: [
        {
          citation: 'Sales increased 15%.',
          sourceLabel: 'Q1-report.pdf',
          contextType: 'document_library',
          documentId: 'doc-123',
          embeddingId: 'emb-456',
          startPosition: 0,
          endPosition: 100,
        },
      ],
      graphContext: undefined,
    });
    mockAddContextToMessage.mockReturnValue('You have access to 1 file:\nQ1-report.pdf\n\n[Documents:]\nFile: Q1-report.pdf\nSales increased 15%.');

    const primitive = makePrimitive('Summarize the report.');
    const context = makeContext({
      documents: [{ id: 'doc-123', name: 'Q1-report.pdf', content: 'Sales increased 15%.' }],
    });

    const result = await primitive.execute(context);

    expect(result.status).toBe('success');
    expect(result.output.response).toBe('mock response');
    expect(result.output.graphAnchors).toEqual([]);
    expect(result.output.citations).toHaveLength(1);
    expect(result.output.citations[0]).toMatchObject({
      id: 'Q1-report.pdf',
      content: 'Sales increased 15%.',
      source: 'Q1-report.pdf',
      contextType: 'document_library',
    });
  });

  it('returns empty citations and graphAnchors when no documents are present', async () => {
    const primitive = makePrimitive('What is the capital of France?');
    const context = makeContext({});

    const result = await primitive.execute(context);

    expect(result.status).toBe('success');
    expect(result.output).toEqual({
      response: 'mock response',
      citations: [],
      graphAnchors: [],
    });
  });

  it('returns empty citations on RAG processing error', async () => {
    mockProcessDocuments.mockRejectedValue(new Error('RAG service unavailable'));

    const primitive = makePrimitive('Analyze this document.');
    const context = makeContext({
      documents: [{ id: 'doc1', name: 'report.txt', content: 'Some content.' }],
    });

    const result = await primitive.execute(context);

    expect(result.status).toBe('success');
    expect(result.output).toEqual({
      response: 'mock response',
      citations: [],
      graphAnchors: [],
    });
  });
});

describe('PromptPrimitive inference config', () => {
  it.each([
    {
      label: 'custom temperature and topP',
      configOverrides: { temperature: 0.3, topP: 0.8 },
      expectedSettings: { temperature: 0.3, topP: 0.8 },
    },
    {
      label: 'defaults when neither is set',
      configOverrides: {},
      expectedSettings: { temperature: 0.7, topP: 0.5 },
    },
    {
      label: 'only temperature set, topP defaults',
      configOverrides: { temperature: 1.0 },
      expectedSettings: { temperature: 1.0, topP: 0.5 },
    },
    {
      label: 'only topP set, temperature defaults',
      configOverrides: { topP: 0.1 },
      expectedSettings: { temperature: 0.7, topP: 0.1 },
    },
  ])('passes correct inference params to the adapter ($label)', async ({ configOverrides, expectedSettings }) => {
    const primitive = makePrimitive('Test prompt.', configOverrides);
    const context = makeContext({});

    await primitive.execute(context);

    expect(AiFactoryCompletionAdapter).toHaveBeenCalledWith(
      {},
      {
        temperature: expectedSettings.temperature,
        topP: expectedSettings.topP,
        frequencyPenalty: 0,
        presencePenalty: 0,
      },
    );
  });

  // Workflow retrievals are charged to the primitive that made them, matching
  // how the primitive's own LLM call is already attributed.
  it('attributes the query embedding to the primitive', async () => {
    const mockContext = makeContext({
      documents: [{ id: 'doc-1', name: 'file.txt', content: 'test' }],
    });

    const primitive = makePrimitive('Summarize this.');
    await primitive.execute(mockContext);

    expect(mockProcessDocuments).toHaveBeenCalledWith(
      expect.any(String),
      mockContext.userId,
      expect.any(Array),
      false,
      expect.any(Boolean),
      {
        workflowExecutionId: mockContext.executionId,
        primitiveId: 'step-llm',
        stepLabel: 'query embedding',
      },
    );
  });

  // The primitive retrieves twice — once to build the prompt, once to collect
  // citations for its output — and the provider bills both embeddings. Without
  // attribution on the second, per-artifact totals silently undercount.
  it('attributes the output citation embedding to the primitive', async () => {
    const mockContext = makeContext({
      documents: [{ id: 'doc-1', name: 'file.txt', content: 'test' }],
    });

    const primitive = makePrimitive('Summarize this.');
    await primitive.execute(mockContext);

    expect(mockProcessDocuments).toHaveBeenCalledWith(
      expect.any(String),
      mockContext.userId,
      expect.any(Array),
      false,
      false,
      {
        workflowExecutionId: mockContext.executionId,
        primitiveId: 'step-llm',
        stepLabel: 'output citations',
      },
    );
  });
});
