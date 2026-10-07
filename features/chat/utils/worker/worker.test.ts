import { processChatJob } from './worker';
import { runAgenticChat } from '@/features/chat/services/agenticChat';
import { getGraphDatabaseSource } from '@/features/graph-database';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { AIFactory } from '@/features/ai-provider';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import assignChatUseCase from '@/features/chat/services/assignChatUseCase';
import db from '@/server/db';
import type { Job } from 'bullmq';
import type { ChatJobData } from './queue';
import { MessageRole } from '@/features/chat/types/message';

// --- Heavy dependency surface mocked to minimal viable returns. We only exercise
// --- the agentic chat branch + end-of-turn graph assembly + array persistence.
jest.mock('@/features/graph-database/utils/isMemoryEnabled', () => ({
  isMemoryEnabled: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/features/graph-database/utils/worker/conversationGraphQueue', () => ({
  enqueueConversationGraphSync: jest.fn(),
}));
jest.mock('@prisma/client', () => ({ Prisma: {} }));
jest.mock('bullmq', () => ({ Worker: jest.fn(), Job: jest.fn() }));
jest.mock('@/server/storage/redis', () => ({ storage: { hset: jest.fn(), del: jest.fn(), rpush: jest.fn(), publish: jest.fn(), lrange: jest.fn().mockResolvedValue([]) } }));
jest.mock('@/server/storage/redisConnection', () => ({ getRedisClient: jest.fn() }));
jest.mock('@/features/ai-agents/utils/shared/types', () => ({ DEFAULT_WORKER_CONFIG: {}, WORKER_SHUTDOWN_TIMEOUT: 1000 }));

jest.mock('@/server/logger', () => {
  const l: Record<string, jest.Mock> = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), child: jest.fn() };
  l.child.mockReturnValue(l);
  return { __esModule: true, default: l, logger: l };
});

jest.mock('@/server/db', () => {
  const prismaMock: Record<string, unknown> = {
    chat: { findUnique: jest.fn() },
    chatMessage: { update: jest.fn(), findMany: jest.fn() },
    chatArtifact: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    chatMessageFollowUp: { createMany: jest.fn() },
    graphSearchResult: { create: jest.fn() },
    chatMessageCitation: { createMany: jest.fn() },
    gitHubProvider: { count: jest.fn().mockResolvedValue(0) },
    systemConfig: { findFirst: jest.fn().mockResolvedValue({ fastAiProviderModelId: null }) },
  };
  prismaMock.$transaction = jest.fn(async (cb: (p: unknown) => unknown) => cb(prismaMock));
  return { __esModule: true, default: prismaMock };
});

jest.mock('@/features/chat/services/agenticChat', () => ({ runAgenticChat: jest.fn() }));
// Mocked rather than left to run: the real service reads SystemConfig, which this
// file's db mock does not carry, and it swallows its own failures — so an unmocked
// one would no-op silently and the assertion below would pass for the wrong reason.
jest.mock('@/features/chat/services/assignChatUseCase', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/features/chat/dal/getMessages', () => ({ __esModule: true, default: jest.fn().mockResolvedValue([]) }));
jest.mock('@/features/chat/knowledge-bases/addContextToMessage', () => ({ __esModule: true, default: jest.fn((m: string) => m) }));
jest.mock('@/features/chat/utils/chatContextHelpers', () => ({
  buildSystemContext: jest.fn().mockResolvedValue({
    userKnowledgeBases: [],
    selectedKnowledgeBases: [],
    hasDocumentLibrary: true,
    documentsWithSelectionState: [],
  }),
  processDocuments: jest.fn().mockResolvedValue({ citations: [] }),
  processKnowledgeBases: jest.fn().mockResolvedValue({ citations: [] }),
  combineCitations: jest.fn((a: unknown[]) => a),
}));
jest.mock('@/features/kb-provider', () => ({ KBFactory: jest.fn() }));
jest.mock('@/server/auditor', () => ({ createAuditor: jest.fn() }));
jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => ({
  extractArtifactsFromMessage: jest.fn((t: string) => ({ artifacts: [], cleanedText: t })),
  addChatMessageIdToArtifacts: jest.fn(),
}));
jest.mock('@/features/chat/utils/followUpQuestionsHelpers', () => ({
  extractFollowUpQuestionsFromMessage: jest.fn((t: string) => ({ followUpQuestions: [], cleanedText: t })),
}));
jest.mock('@/features/ai-provider', () => ({
  AIFactory: jest.fn().mockImplementation(() => ({
    buildUserSource: jest.fn().mockResolvedValue({ source: { chatCompletion: jest.fn().mockResolvedValue('mock response'), chatCompletionWithTools: jest.fn() }, model: { externalId: 'ext-model-1' } }),
    // The agentic path caches the unwrapped source from buildSource, then
    // re-wraps it per request via wrapUserSource.
    buildSource: jest.fn().mockResolvedValue({ source: { chatCompletionWithTools: jest.fn() }, provider: { id: 'provider-1' }, model: { externalId: 'ext-model-1' } }),
    wrapUserSource: jest.fn().mockResolvedValue({ source: { chatCompletionWithTools: jest.fn() }, provider: { id: 'provider-1' }, model: { externalId: 'ext-model-1' } }),
  })),
}));
jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn().mockImplementation(() => ({
    buildUserSource: jest.fn().mockResolvedValue({ source: { chatCompletion: jest.fn().mockResolvedValue('mock response'), chatCompletionWithTools: jest.fn() }, model: { externalId: 'ext-model-1' } }),
    // The agentic path caches the unwrapped source from buildSource, then
    // re-wraps it per request via wrapUserSource.
    buildSource: jest.fn().mockResolvedValue({ source: { chatCompletionWithTools: jest.fn() }, provider: { id: 'provider-1' }, model: { externalId: 'ext-model-1' } }),
    wrapUserSource: jest.fn().mockResolvedValue({ source: { chatCompletionWithTools: jest.fn() }, provider: { id: 'provider-1' }, model: { externalId: 'ext-model-1' } }),
  })),
}));
jest.mock('@/features/shared/dal/getAccessibleDocumentIds', () => ({ __esModule: true, default: jest.fn().mockResolvedValue(new Set(['doc-1'])) }));
jest.mock('@/features/graph-database/services/buildNodeMapping', () => ({ buildNodeMapping: jest.fn(() => []) }));
jest.mock('@/features/graph-database/services/queryRouter', () => ({
  classifyQuery: jest.fn().mockResolvedValue({ activeTypes: [], primaryType: null, confidences: {} }),
}));
jest.mock('@/features/graph-database/services/enumerationQuery', () => ({
  enumerationQuery: jest.fn().mockResolvedValue({ rowCount: 0, results: [], generatedCypher: '', error: null }),
}));
jest.mock('@/features/graph-database/services/aggregationQuery', () => ({
  aggregationQuery: jest.fn().mockResolvedValue({ rowCount: 0, results: [], generatedCypher: '', error: null }),
}));
jest.mock('@/features/graph-database/services/explanationQuery', () => ({
  explanationQuery: jest.fn().mockResolvedValue({ citations: [] }),
}));
// Mocked so the up-front schema fetch doesn't touch getGraphDatabaseSource — that
// call count is the proxy for "graphData built once" (via fetchEnumerationGraphData).
jest.mock('@/features/graph-database/dal/getGraphSchema', () => ({ getScopedGraphSchema: jest.fn().mockResolvedValue('Node Types:\n- Entity: {name}') }));
jest.mock('@/features/graph-database', () => ({ getGraphDatabaseSource: jest.fn() }));

const prismaMock = db as unknown as {
  chat: { findUnique: jest.Mock };
  chatMessage: { update: jest.Mock; findMany: jest.Mock };
  graphSearchResult: { create: jest.Mock };
  chatMessageCitation: { createMany: jest.Mock };
};

const makeJob = (overrides: Partial<ChatJobData> = {}): Job<ChatJobData> =>
  ({
    data: {
      jobId: 'job-1',
      userId: 'user-1',
      chatId: 'chat-1',
      messageId: 'msg-1',
      modelId: 'model-1',
      userMessage: 'hi',
      originalUserMessage: 'hi',
      documentIds: ['doc-1'],
      knowledgeBaseIds: [],
      citations: [],
      deepResearchEnabled: false,
      useAgenticChat: true,
      useGraph: true,
      ...overrides,
    },
  } as unknown as Job<ChatJobData>);

const rec = (obj: Record<string, unknown>) => ({ get: (k: string) => obj[k] });

describe('processChatJob — agentic end-of-turn graph assembly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    prismaMock.chat.findUnique.mockResolvedValue({ userId: 'user-1' });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run: jest.fn().mockResolvedValue({ records: [] }) });
  });

  it('assembles agentic results into an array, builds graphData ONCE, and persists the array', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'the answer',
      citations: [],
      graphSearchResults: [
        { query: 'q1', generatedCypher: 'C1', rowCount: 1, rows: [{ name: 'A' }], nodeMapping: [{ rowIndex: 0, colKey: 'name', entityIds: ['id-1'] }] },
        { query: 'q2', generatedCypher: 'C2', rowCount: 1, rows: [{ name: 'B' }], nodeMapping: [{ rowIndex: 0, colKey: 'name', entityIds: ['id-2'] }] },
      ],
    });

    await processChatJob(makeJob());

    expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({
      where: { id: 'chat-1' },
      select: { userId: true },
    });
    // the scoped graph schema is injected into the agent up front (graph mode)
    expect(getScopedGraphSchema).toHaveBeenCalledTimes(1);
    expect(runAgenticChat).toHaveBeenCalledWith(
      expect.objectContaining({
        graphSchema: expect.stringContaining('Node Types'),
        memoryEnabled: true,
      }),
    );

    // graphData built exactly once over the union of entity ids (not once per payload)
    expect(getGraphDatabaseSource).toHaveBeenCalledTimes(1);

    // persisted as a JSON ARRAY with one element per cypher call
    expect(prismaMock.graphSearchResult.create).toHaveBeenCalledTimes(1);
    const arg = prismaMock.graphSearchResult.create.mock.calls[0][0];
    expect(Array.isArray(arg.data.data)).toBe(true);
    expect(arg.data.data).toHaveLength(2);
    expect(arg.data.data[0].query).toBe('q1');
    // each element carries the shared graphData built at end-of-turn
    expect(arg.data.data[0]).toHaveProperty('graphData');
    expect(prismaMock.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'msg-1' }, data: expect.objectContaining({ content: 'the answer' }) }),
    );
  });

  it('passes the job\'s selected user group through to the AI factory', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({ finalText: 'the answer', citations: [], graphSearchResults: [] });

    await processChatJob(makeJob({ userGroupId: 'group-9' }));

    expect(AIFactory).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', userGroupId: 'group-9' }));
  });

  it('passes the job\'s selected user group through to agentic chat, so its usage attributes to it', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({ finalText: 'the answer', citations: [], graphSearchResults: [] });

    await processChatJob(makeJob({ userGroupId: 'group-9' }));

    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({ userGroupId: 'group-9' }));
  });

  it('persists no graph search result when the agent ran zero cypher calls', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({ finalText: 'pure rag answer', citations: [], graphSearchResults: [] });

    await processChatJob(makeJob());

    expect(getGraphDatabaseSource).not.toHaveBeenCalled();
    expect(prismaMock.graphSearchResult.create).not.toHaveBeenCalled();
  });

  it('passes a disabled Memory toggle to agentic chat', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);
    (runAgenticChat as jest.Mock).mockResolvedValue({ finalText: 'answer', citations: [], graphSearchResults: [] });

    await processChatJob(makeJob());

    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({ memoryEnabled: false }));
  });

  it('disables memory when the requester does not own the destination chat', async () => {
    prismaMock.chat.findUnique.mockResolvedValue({ userId: 'chat-owner-1' });
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'answer',
      citations: [],
      graphSearchResults: [],
    });

    await processChatJob(makeJob());

    expect(isMemoryEnabled).toHaveBeenCalled();
    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({
      memoryEnabled: false,
    }));
  });

  it('enriches an owned cited message and persists a prior-conversation citation', async () => {
    const citedCreatedAt = new Date('2026-08-10T12:00:00.000Z');
    const artifactCreatedAt = new Date('2026-08-09T12:00:00.000Z');
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        id: 'cited-message-1',
        chatId: 'source-chat-1',
        role: MessageRole.Assistant,
        createdAt: citedCreatedAt,
        content: 'We decided to use pgvector.',
        chat: { summary: 'Architecture decisions' },
        chatArtifacts: [{
          id: 'artifact-1',
          label: 'Decision log',
          fileExtension: '.docx',
          createdAt: artifactCreatedAt,
        }],
      },
    ]);
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'We chose pgvector [[C1]].',
      citations: [],
      graphSearchResults: [],
      handleMap: {
        C1: { messageId: 'cited-message-1', chatId: 'source-chat-1' },
      },
    });

    await processChatJob(makeJob({ useGraph: false }));

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['cited-message-1'] },
        chat: { userId: 'user-1' },
      },
      select: {
        id: true,
        chatId: true,
        role: true,
        createdAt: true,
        content: true,
        chat: { select: { summary: true } },
        chatArtifacts: {
          select: {
            id: true,
            label: true,
            fileExtension: true,
            createdAt: true,
          },
        },
      },
    });
    expect(prismaMock.chatMessageCitation.createMany).toHaveBeenCalledWith({
      data: [{
        chatMessageId: 'msg-1',
        citedMessageId: 'cited-message-1',
        citation: 'We decided to use pgvector.',
      }],
    });
  });

  it('silently drops a cited message that is not returned by the ownership-scoped lookup', async () => {
    prismaMock.chat.findUnique.mockResolvedValue({ userId: 'chat-owner-1' });
    prismaMock.chatMessage.findMany.mockResolvedValue([]);
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'A claim [[C1]].',
      citations: [],
      graphSearchResults: [],
      handleMap: {
        C1: { messageId: 'other-users-message', chatId: 'other-users-chat' },
      },
    });

    await expect(processChatJob(makeJob({ useGraph: false }))).resolves.toEqual({ success: true });

    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: ['other-users-message'] },
        chat: {
          userId: 'chat-owner-1',
        },
      },
    }));
    expect(prismaMock.chatMessageCitation.createMany).not.toHaveBeenCalled();
  });

  it('skips the schema fetch and sends an empty graphSchema in vector-only mode', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({ finalText: 'vector-only answer', citations: [], graphSearchResults: [] });

    await processChatJob(makeJob({ useGraph: false }));

    // no Neo4j round-trip for the schema when graph mode is off
    expect(getScopedGraphSchema).not.toHaveBeenCalled();
    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({ graphSchema: '' }));
  });

  it('graph mode + cited handles: builds an evidence-first array (cited edge only) and strips markers', async () => {
    // Neo4j returns the two cited nodes (anchor query) and the one cited edge (UNWIND query).
    const run = jest.fn((q: string) => {
      if (q.includes('UNWIND $edges')) {
        return Promise.resolve({ records: [rec({ rFromNeoId: 10, rToNeoId: 20, rType: 'CONTRACTS_WITH', rProps: {} })] });
      }
      if (q.includes('MATCH (anchor)')) {
        return Promise.resolve({
          records: [
            rec({ anchorNeoId: 10, anchorLabels: ['Organization'], anchorProps: { id: 'uuid-a', name: 'Acme', type: 'ORGANIZATION', description: '' } }),
            rec({ anchorNeoId: 20, anchorLabels: ['Agency'], anchorProps: { id: 'uuid-b', name: 'DHS', category: 'GOV', description: '' } }),
          ],
        });
      }
      return Promise.resolve({ records: [] });
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });

    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'Acme [[E1]] contracts with DHS [[E2]] via [[R1]].',
      citations: [],
      graphSearchResults: [
        {
          query: 'rel q',
          generatedCypher: 'C',
          rowCount: 1,
          rows: [{ source: 'Acme', target: 'DHS' }],
          nodeMapping: [{ rowIndex: 0, colKey: 'source', entityIds: ['uuid-a'] }],
          edgeMapping: [{ rowIndex: 0, src: 'uuid-a', relType: 'CONTRACTS_WITH', tgt: 'uuid-b' }],
        },
      ],
      handleMap: { E1: 'uuid-a', E2: 'uuid-b', R1: { src: 'uuid-a', relType: 'CONTRACTS_WITH', tgt: 'uuid-b' } },
    });

    await processChatJob(makeJob());

    // the agent was told to cite (graph mode)
    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({ citeEvidence: true }));

    const data = prismaMock.graphSearchResult.create.mock.calls[0][0].data.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    // [evidence, ...exploration]
    expect(data[0].kind).toBe('evidence');
    expect(data[1].kind).toBe('exploration');
    // evidence graphData carries exactly the cited nodes + the single cited edge
    expect(data[0].graphData.nodes).toHaveLength(2);
    expect(data[0].graphData.edges).toHaveLength(1);
    expect(data[0].graphData.edges[0].type).toBe('CONTRACTS_WITH');

    // the persisted answer has the markers stripped
    const content = prismaMock.chatMessage.update.mock.calls[1][0].data.content;
    expect(content).not.toContain('[[');
    expect(content).toBe('Acme contracts with DHS via.');
  });

  it('graph mode + cited nodes but NO cited edges: floors to induced edges among the cited nodes', async () => {
    const run = jest.fn((q: string) => {
      if (q.includes('MATCH (anchor)')) {
        return Promise.resolve({
          records: [
            rec({ anchorNeoId: 10, anchorLabels: ['Agency'], anchorProps: { id: 'uuid-a', name: 'NSA' } }),
            rec({ anchorNeoId: 20, anchorLabels: ['Organization'], anchorProps: { id: 'uuid-b', name: 'Quantifind' } }),
          ],
        });
      }
      // the induced-edge floor query (the only one with the a1.id < a2.id guard)
      if (q.includes('a1.id < a2.id')) {
        return Promise.resolve({ records: [rec({ rType: 'AGENCY_FIT', rProps: {}, rFromNeoId: 10, rToNeoId: 20 })] });
      }
      return Promise.resolve({ records: [] });
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });

    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'NSA [[E1]] is a strong fit for Quantifind [[E2]].',
      citations: [],
      graphSearchResults: [
        { query: 'q', generatedCypher: 'C', rowCount: 2, rows: [{ a: 'NSA' }, { b: 'Quantifind' }], nodeMapping: [{ rowIndex: 0, colKey: 'a', entityIds: ['uuid-a'] }, { rowIndex: 1, colKey: 'b', entityIds: ['uuid-b'] }] },
      ],
      handleMap: { E1: 'uuid-a', E2: 'uuid-b' }, // entities cited, NO [[R#]] — no cited edges
    });

    await processChatJob(makeJob());

    const data = prismaMock.graphSearchResult.create.mock.calls[0][0].data.data;
    expect(data[0].kind).toBe('evidence');
    expect(data[0].graphData.nodes).toHaveLength(2);
    // floor tier: the induced AGENCY_FIT edge among the two cited nodes is rendered
    expect(data[0].graphData.edges).toHaveLength(1);
    expect(data[0].graphData.edges[0].type).toBe('AGENCY_FIT');
    // the induced-floor query was actually run
    expect(run.mock.calls.some(([q]: [string]) => q.includes('a1.id < a2.id'))).toBe(true);
  });

  it('no cited handles: sends citeEvidence=true but falls back to the legacy union (no evidence entry)', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'A plain graph answer.',
      citations: [],
      graphSearchResults: [
        { query: 'q1', generatedCypher: 'C1', rowCount: 1, rows: [{ name: 'A' }], nodeMapping: [{ rowIndex: 0, colKey: 'name', entityIds: ['id-1'] }] },
      ],
      handleMap: {},
    });

    await processChatJob(makeJob());

    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({ citeEvidence: true }));
    const data = prismaMock.graphSearchResult.create.mock.calls[0][0].data.data;
    // answer cited no resolvable handles → legacy union: every entry carries the shared
    // graphData, none is the evidence subgraph
    expect(data.every((d: { kind?: string }) => d.kind !== 'evidence')).toBe(true);
    expect(data[0]).toHaveProperty('graphData');
  });

  it('graph mode + only [[Q#]] cited over a CAPPED query: builds full evidence from server-side mappings', async () => {
    // The headline fix: the agent cited NO [[E#]]/[[R#]] (the 790 rows were capped out of its
    // view) — only the query handle. The worker must still build the full evidence graph from the
    // retrieval's server-side nodeMapping/edgeMapping (which it holds regardless of the cap).
    const run = jest.fn((q: string) => {
      if (q.includes('UNWIND $edges')) {
        return Promise.resolve({ records: [rec({ rFromNeoId: 10, rToNeoId: 20, rType: 'CONTRACTS_WITH', rProps: {} })] });
      }
      if (q.includes('MATCH (anchor)')) {
        return Promise.resolve({
          records: [
            rec({ anchorNeoId: 10, anchorLabels: ['Agency'], anchorProps: { id: 'uuid-a', name: 'CISA' } }),
            rec({ anchorNeoId: 20, anchorLabels: ['Organization'], anchorProps: { id: 'uuid-b', name: 'Acme' } }),
          ],
        });
      }
      return Promise.resolve({ records: [] });
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });

    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'All agencies and how they connect to companies [[Q1]].',
      citations: [],
      graphSearchResults: [
        {
          query: 'agencies connected to companies',
          generatedCypher: 'MATCH (a:Agency)-[r]-(c:Organization) RETURN a, type(r), c',
          rowCount: 790,
          rows: [], // capped: rows omitted from the agent view
          nodeMapping: [
            { rowIndex: 0, colKey: 'agency', entityIds: ['uuid-a'] },
            { rowIndex: 0, colKey: 'company', entityIds: ['uuid-b'] },
          ],
          edgeMapping: [{ rowIndex: 0, src: 'uuid-a', relType: 'CONTRACTS_WITH', tgt: 'uuid-b' }],
        },
      ],
      handleMap: { Q1: 0 }, // Q1 -> the (only) graph_search_results entry, index 0
    });

    await processChatJob(makeJob());

    expect(runAgenticChat).toHaveBeenCalledWith(expect.objectContaining({ citeEvidence: true }));

    const data = prismaMock.graphSearchResult.create.mock.calls[0][0].data.data;
    expect(data).toHaveLength(2);
    // [evidence, ...exploration] — the cited query is expanded into the evidence subgraph
    expect(data[0].kind).toBe('evidence');
    expect(data[1].kind).toBe('exploration');
    // the full server-side mappings drove a complete graph despite the agent never seeing the rows
    expect(data[0].graphData.nodes).toHaveLength(2);
    expect(data[0].graphData.edges).toHaveLength(1);
    expect(data[0].graphData.edges[0].type).toBe('CONTRACTS_WITH');
    // the cited-precision tier ran (the query's edgeMapping triple was matched, not floored)
    expect(run.mock.calls.some(([q]: [string]) => q.includes('UNWIND $edges'))).toBe(true);

    // the [[Q1]] marker is stripped from the persisted answer
    const content = prismaMock.chatMessage.update.mock.calls[1][0].data.content;
    expect(content).not.toContain('[[');
    expect(content).toBe('All agencies and how they connect to companies.');
  });

  it('graph mode + [[Q#]] over a node-only capped query (no edgeMapping): floors to induced edges', async () => {
    // Proves Q# composes with the two-tier edge floor: a cited query that carries node ids but no
    // edgeMapping yields zero cited-precision edges, so the floor induces the edges among its nodes.
    const run = jest.fn((q: string) => {
      if (q.includes('MATCH (anchor)')) {
        return Promise.resolve({
          records: [
            rec({ anchorNeoId: 10, anchorLabels: ['Agency'], anchorProps: { id: 'uuid-a', name: 'CISA' } }),
            rec({ anchorNeoId: 20, anchorLabels: ['Organization'], anchorProps: { id: 'uuid-b', name: 'Acme' } }),
          ],
        });
      }
      if (q.includes('a1.id < a2.id')) {
        return Promise.resolve({ records: [rec({ rType: 'AGENCY_FIT', rProps: {}, rFromNeoId: 10, rToNeoId: 20 })] });
      }
      return Promise.resolve({ records: [] });
    });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });

    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'Here is the full agency↔company connection set [[Q1]].',
      citations: [],
      graphSearchResults: [
        {
          query: 'agencies connected to companies',
          generatedCypher: 'MATCH (a:Agency), (c:Organization) RETURN a, c',
          rowCount: 790,
          rows: [],
          nodeMapping: [
            { rowIndex: 0, colKey: 'agency', entityIds: ['uuid-a'] },
            { rowIndex: 0, colKey: 'company', entityIds: ['uuid-b'] },
          ],
          // no edgeMapping — node-only retrieval
        },
      ],
      handleMap: { Q1: 0 },
    });

    await processChatJob(makeJob());

    const data = prismaMock.graphSearchResult.create.mock.calls[0][0].data.data;
    expect(data[0].kind).toBe('evidence');
    expect(data[0].graphData.nodes).toHaveLength(2);
    // floor tier: the induced AGENCY_FIT edge among the cited query's nodes is rendered
    expect(data[0].graphData.edges).toHaveLength(1);
    expect(data[0].graphData.edges[0].type).toBe('AGENCY_FIT');
    expect(run.mock.calls.some(([q]: [string]) => q.includes('a1.id < a2.id'))).toBe(true);
  });

  it('graph mode + [[Q#]] index out of range: drops it (no synthetic) and falls back to the legacy union', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'Dangling query handle [[Q5]] with no backing entry.',
      citations: [],
      graphSearchResults: [
        { query: 'q', generatedCypher: 'C', rowCount: 1, rows: [{ name: 'A' }], nodeMapping: [{ rowIndex: 0, colKey: 'name', entityIds: ['id-1'] }] },
      ],
      handleMap: { Q5: 9 }, // index 9 is out of range for a 1-element graphSearchResults
    });

    await processChatJob(makeJob());

    const data = prismaMock.graphSearchResult.create.mock.calls[0][0].data.data;
    // no resolvable citation -> no evidence subgraph -> legacy union path (regression guard)
    expect(data.every((d: { kind?: string }) => d.kind !== 'evidence')).toBe(true);
    // the dangling marker is still stripped from the persisted answer
    const content = prismaMock.chatMessage.update.mock.calls[0][0].data.content;
    expect(content).not.toContain('[[');
  });

  // The query embedding is part of what the message cost, so it carries the
  // same message id as the response usage row.
  it('attributes the query embedding to the chat message', async () => {
    const mockJob = makeJob({ useAgenticChat: false, useGraph: false });
    const { processDocuments } = require('@/features/chat/utils/chatContextHelpers');

    await processChatJob(mockJob);

    expect(processDocuments).toHaveBeenCalledWith(
      expect.any(String),
      mockJob.data.userId,
      mockJob.data.documentIds,
      false,
      expect.any(Boolean),
      { chatMessageId: mockJob.data.messageId, stepLabel: 'query embedding' },
    );
  });

  it('passes the job\'s selected user group through to the graph query-router functions', async () => {
    const { classifyQuery } = require('@/features/graph-database/services/queryRouter');
    const { enumerationQuery } = require('@/features/graph-database/services/enumerationQuery');
    const { aggregationQuery } = require('@/features/graph-database/services/aggregationQuery');
    const { explanationQuery } = require('@/features/graph-database/services/explanationQuery');

    classifyQuery.mockResolvedValueOnce({
      confidences: { enumeration: 1, aggregation: 1, explanation: 1 },
      activeTypes: ['enumeration', 'aggregation', 'explanation'],
      primaryType: 'enumeration',
    });

    await processChatJob(makeJob({ useAgenticChat: false, userGroupId: 'group-9' }));

    expect(classifyQuery).toHaveBeenCalledWith('hi', 'user-1', ['doc-1'], undefined, 'group-9');
    expect(enumerationQuery).toHaveBeenCalledWith(expect.objectContaining({ userGroupId: 'group-9' }));
    expect(aggregationQuery).toHaveBeenCalledWith(expect.objectContaining({ userGroupId: 'group-9' }));
    expect(explanationQuery).toHaveBeenCalledWith(expect.objectContaining({ userGroupId: 'group-9' }));
  });

  // Categorization happens here rather than in the route that titled the chat,
  // because the route returns before this worker has produced a reply to judge. The
  // reply is asserted explicitly: a category derived from the request alone is the
  // defect this exists to prevent, and it would not fail any other assertion.
  it('categorizes the chat from the persisted reply', async () => {
    (runAgenticChat as jest.Mock).mockResolvedValue({
      finalText: 'the answer',
      citations: [],
      graphSearchResults: [],
    });

    await processChatJob(makeJob());

    expect(assignChatUseCase).toHaveBeenCalledWith({
      chatId: 'chat-1',
      userMessage: 'hi',
      assistantMessage: 'the answer',
    });
  });
});
