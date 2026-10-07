import { AIFactory } from '@/features/ai-provider/factory';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import {
  ARTIFACT_SEARCH_PAGE_SIZE,
  CONVERSATION_ENTITY_FILTER_LIMIT,
} from '@/features/graph-database/config/conversation-graph.config';
import findArtifacts from '@/features/graph-database/dal/findArtifacts';
import getConversationArtifact from '@/features/graph-database/dal/getConversationArtifact';
import getConversationMessages from '@/features/graph-database/dal/getConversationMessages';
import getConversationsForEntities from '@/features/graph-database/dal/getConversationsForEntities';
import getGraphNodeNames from '@/features/graph-database/dal/getGraphNodeNames';
import getRecentConversations from '@/features/graph-database/dal/getRecentConversations';
import resolveGraphNodesByName from '@/features/graph-database/dal/resolveGraphNodesByName';
import searchChatMessages from '@/features/graph-database/dal/searchChatMessages';
import {
  extractSearchTerms,
  hybridEntitySearch,
  hybridConceptSearch,
  scoreGapFilter,
  filterAnchorsForRelevance,
} from '@/features/graph-database/services/search';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import {
  callAnalyzeData,
  callFindArtifacts,
  callGetConversationArtifact,
  callGetConversationMessages,
  callGetRecentConversations,
  callSearch,
  callSearchConversations,
  TOOLS,
  TOOL_HANDLERS,
} from '@/features/shared/services/mcpTools';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/features/ai-provider/factory');
jest.mock('@/features/chat/dal/getEmbeddingsForDocuments');
jest.mock('@/features/graph-database/dal/findArtifacts');
jest.mock('@/features/graph-database/dal/getConversationArtifact');
jest.mock('@/features/graph-database/dal/getConversationMessages');
jest.mock('@/features/graph-database/dal/getConversationsForEntities');
jest.mock('@/features/graph-database/dal/getGraphNodeNames');
jest.mock('@/features/graph-database/dal/getRecentConversations');
jest.mock('@/features/graph-database/dal/resolveGraphNodesByName');
jest.mock('@/features/graph-database/dal/searchChatMessages');
jest.mock('@/features/graph-database/services/search');
jest.mock('@/features/graph-database/utils/isMemoryEnabled');
jest.mock('@/features/shared/dal/document-library/upload/embedContent');
jest.mock('@/features/shared/dal/getAccessibleDocumentIds');
jest.mock('@/features/shared/services/repoService/tools', () => ({
  REPO_SERVICE_TOOLS: [],
  REPO_SERVICE_HANDLERS: {},
}));
// One factory serves every describe block: the memory tools read chatArtifact,
// the attribution tests read document and model.
jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatArtifact: { findMany: jest.fn() },
    document: { findFirst: jest.fn(), findMany: jest.fn() },
    model: { findUnique: jest.fn() },
  },
}));
jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSearchChatMessages = searchChatMessages as jest.Mock;
const mockFindArtifacts = findArtifacts as jest.Mock;
const mockGetConversationArtifact = getConversationArtifact as jest.Mock;
const mockGetRecentConversations = getRecentConversations as jest.Mock;
const mockGetConversationMessages = getConversationMessages as jest.Mock;
const mockGetConversationsForEntities = getConversationsForEntities as jest.Mock;
const mockGetGraphNodeNames = getGraphNodeNames as jest.Mock;
const mockResolveGraphNodesByName = resolveGraphNodesByName as jest.Mock;
const mockEmbedContent = embedContent as jest.Mock;
const findArtifactRows = db.chatArtifact.findMany as jest.Mock;
const mockGetEmbeddings = getEmbeddingsForDocuments as jest.MockedFunction<typeof getEmbeddingsForDocuments>;
const mockGetAccessible = getAccessibleDocumentIds as jest.MockedFunction<typeof getAccessibleDocumentIds>;
const mockExtractSearchTerms = extractSearchTerms as jest.Mock;
const mockHybridEntitySearch = hybridEntitySearch as jest.Mock;
const mockHybridConceptSearch = hybridConceptSearch as jest.Mock;
const mockScoreGapFilter = scoreGapFilter as jest.Mock;
const mockFilterAnchorsForRelevance = filterAnchorsForRelevance as jest.Mock;
const mockBuildKnowledgeGraphSource = AIFactory.prototype.buildKnowledgeGraphSource as jest.Mock;

const CHAT_MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

const searchArgs = {
  userId: 'user-1',
  query: 'procurement decision',
  chatId: 'chat-current',
};

describe('conversation memory MCP tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);
    mockEmbedContent.mockResolvedValue({ embeddings: [{ embedding: [0.1, 0.2] }] });
    mockSearchChatMessages.mockResolvedValue([]);
    mockFindArtifacts.mockResolvedValue([]);
    mockGetRecentConversations.mockResolvedValue([]);
    mockGetConversationMessages.mockResolvedValue({
      chatId: 'chat-1',
      title: 'Prior chat',
      messageCount: 0,
      messages: [],
    });
    mockGetConversationArtifact.mockResolvedValue({
      id: 'artifact-1',
      contentType: 'text',
      content: 'Artifact content',
    });
    mockGetConversationsForEntities.mockResolvedValue([]);
    mockGetGraphNodeNames.mockResolvedValue([]);
    mockResolveGraphNodesByName.mockResolvedValue([]);
    mockGetAccessible.mockResolvedValue(
      new Set(['doc-1']) as unknown as Awaited<ReturnType<typeof getAccessibleDocumentIds>>,
    );
    findArtifactRows.mockResolvedValue([]);
  });

  it.each([
    ['search_conversations', callSearchConversations, searchArgs],
    [
      'get_recent_conversations',
      callGetRecentConversations,
      { userId: 'user-1', chatId: 'chat-current' },
    ],
    [
      'get_conversation_messages',
      callGetConversationMessages,
      { userId: 'user-1', chatId: 'chat-1' },
    ],
    [
      'get_conversation_artifact',
      callGetConversationArtifact,
      { userId: 'user-1', artifactId: 'artifact-1' },
    ],
    [
      'find_artifacts',
      callFindArtifacts,
      { userId: 'user-1' },
    ],
  ])('gates %s at the handler before any data-serving call', async (_name, handler, args) => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);

    await expect(handler(args)).resolves.toEqual({
      error: 'Conversation memory is not enabled',
    });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockSearchChatMessages).not.toHaveBeenCalled();
    expect(mockGetRecentConversations).not.toHaveBeenCalled();
    expect(mockGetConversationMessages).not.toHaveBeenCalled();
    expect(mockGetConversationArtifact).not.toHaveBeenCalled();
    expect(mockFindArtifacts).not.toHaveBeenCalled();
    expect(mockGetConversationsForEntities).not.toHaveBeenCalled();
  });

  it.each([
    ['search_conversations', callSearchConversations, { query: 'prior decision', chatId: 'chat-current' }],
    ['search_conversations blank', callSearchConversations, { userId: '   ', query: 'prior decision', chatId: 'chat-current' }],
    ['get_recent_conversations', callGetRecentConversations, { chatId: 'chat-current' }],
    ['get_recent_conversations blank', callGetRecentConversations, { userId: '   ', chatId: 'chat-current' }],
    ['get_conversation_messages', callGetConversationMessages, { chatId: 'chat-1' }],
    ['get_conversation_messages blank', callGetConversationMessages, { userId: '   ', chatId: 'chat-1' }],
    ['get_conversation_artifact', callGetConversationArtifact, { artifactId: 'artifact-1' }],
    ['get_conversation_artifact blank', callGetConversationArtifact, { userId: '   ', artifactId: 'artifact-1' }],
    ['find_artifacts', callFindArtifacts, {}],
    ['find_artifacts blank', callFindArtifacts, { userId: '   ' }],
  ])('fails closed when userId is missing for %s', async (_name, handler, args) => {
    await expect(handler(args)).resolves.toEqual({ error: 'User ID is required' });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockSearchChatMessages).not.toHaveBeenCalled();
    expect(mockGetRecentConversations).not.toHaveBeenCalled();
    expect(mockGetConversationMessages).not.toHaveBeenCalled();
    expect(mockGetConversationArtifact).not.toHaveBeenCalled();
    expect(mockFindArtifacts).not.toHaveBeenCalled();
    expect(mockGetConversationsForEntities).not.toHaveBeenCalled();
  });

  it('searches, enriches artifacts, includes entity matches, and emits a full-page cursor', async () => {
    const fullText = `  ${'Verbatim prior message. '.repeat(100)}  `;
    mockSearchChatMessages.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
      messageId: `message-${index}`,
      chatId: `chat-${index}`,
      chatSummary: `Chat ${index}`,
      role: 'assistant',
      text: index === 0 ? fullText : `Text ${index}`,
      createdAt: new Date(`2026-08-0${(index % 9) + 1}T12:00:00.000Z`),
      similarity: 0.8,
      textRank: 0.5,
    })));
    const artifactCreatedAt = new Date('2026-08-01T13:00:00.000Z');
    findArtifactRows.mockResolvedValue([
      {
        id: 'artifact-plan',
        chatMessageId: 'message-0',
        label: 'Plan',
        fileExtension: '.docx',
        createdAt: artifactCreatedAt,
      },
      {
        id: 'artifact-data',
        chatMessageId: 'message-0',
        label: 'Data',
        fileExtension: '.xlsx',
        createdAt: artifactCreatedAt,
      },
    ]);
    mockGetConversationsForEntities.mockResolvedValue([
      {
        chatId: 'chat-current',
        title: 'Current',
        distinctTargets: 2,
        totalMatches: 2,
        matches: [],
      },
      {
        chatId: 'chat-prior',
        title: 'Prior',
        distinctTargets: 1,
        totalMatches: 1,
        matches: [],
      },
    ]);

    const result = await callSearchConversations({
      ...searchArgs,
      entityIds: '["entity-1"]',
      conceptIds: '["concept-1"]',
    }) as Record<string, unknown>;

    expect(mockSearchChatMessages).toHaveBeenCalledWith({
      userId: 'user-1',
      embedding: [0.1, 0.2],
      queryText: 'procurement decision',
      excludeChatId: 'chat-current',
      limit: 10,
      offset: 0,
    });
    expect(findArtifactRows).toHaveBeenCalledWith({
      where: { chatMessageId: { in: Array.from({ length: 10 }, (_, i) => `message-${i}`) } },
      select: {
        id: true,
        chatMessageId: true,
        label: true,
        fileExtension: true,
        createdAt: true,
      },
    });
    expect(mockGetConversationsForEntities).toHaveBeenCalledWith({
      userId: 'user-1',
      ids: ['entity-1', 'concept-1'],
      accessibleDocumentIds: expect.any(Set),
    });
    expect(result.nextCursor).toBe('10');
    expect(result.entityMatches).toEqual([
      {
        chatId: 'chat-prior',
        title: 'Prior',
        distinctTargets: 1,
        totalMatches: 1,
        matches: [],
      },
    ]);
    expect((result.results as Array<Record<string, unknown>>)[0]).toEqual(expect.objectContaining({
      text: fullText,
      artifacts: [
        {
          id: 'artifact-plan',
          label: 'Plan',
          fileExtension: '.docx',
          createdAt: artifactCreatedAt,
        },
        {
          id: 'artifact-data',
          label: 'Data',
          fileExtension: '.xlsx',
          createdAt: artifactCreatedAt,
        },
      ],
    }));
    expect(result.notice).toBe(
      'These are verbatim excerpts from the user\'s prior conversations, not documents.',
    );
  });

  it('returns a null cursor for a short search page', async () => {
    mockSearchChatMessages.mockResolvedValue([{
      messageId: 'message-1',
      chatId: 'chat-1',
      chatSummary: null,
      role: 'user',
      text: 'A short page',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      similarity: null,
      textRank: 0.5,
    }]);

    const result = await callSearchConversations(searchArgs) as { nextCursor: string | null };

    expect(result.nextCursor).toBeNull();
  });

  it('omits entity matches and their lookup after the first search page', async () => {
    const result = await callSearchConversations({
      ...searchArgs,
      cursor: '10',
      entityIds: '["entity-1"]',
    }) as Record<string, unknown>;

    expect(result).not.toHaveProperty('entityMatches');
    expect(mockGetConversationsForEntities).not.toHaveBeenCalled();
  });

  it('falls back to lexical search when embedding fails', async () => {
    const error = new Error('embedding provider unavailable');
    mockEmbedContent.mockRejectedValue(error);

    await callSearchConversations({ ...searchArgs, cursor: '20' });

    expect(mockSearchChatMessages).toHaveBeenCalledWith({
      userId: 'user-1',
      queryText: 'procurement decision',
      excludeChatId: 'chat-current',
      limit: 10,
      offset: 20,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Conversation search embedding failed; using lexical search',
      { userId: 'user-1', error },
    );
  });

  it('short-circuits an empty search without target IDs', async () => {
    await expect(callSearchConversations({
      ...searchArgs,
      query: '   ',
    })).resolves.toEqual({ results: [], nextCursor: null });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockSearchChatMessages).not.toHaveBeenCalled();
  });

  it('returns only entity matches for a blank query with target IDs', async () => {
    mockGetConversationsForEntities.mockResolvedValue([{
      chatId: 'chat-prior',
      title: 'Prior chat',
      distinctTargets: 1,
      totalMatches: 1,
      matches: [{ messageId: 'message-1', position: 0, targetId: 'entity-1' }],
    }]);

    await expect(callSearchConversations({
      ...searchArgs,
      query: '   ',
      entityIds: '["entity-1"]',
    })).resolves.toEqual(expect.objectContaining({
      results: [],
      nextCursor: null,
      entityMatches: [{
        chatId: 'chat-prior',
        title: 'Prior chat',
        distinctTargets: 1,
        totalMatches: 1,
        matches: [{ messageId: 'message-1', position: 0, targetId: 'entity-1' }],
      }],
    }));

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockSearchChatMessages).not.toHaveBeenCalled();
    expect(mockGetConversationsForEntities).toHaveBeenCalledWith({
      userId: 'user-1',
      ids: ['entity-1'],
      accessibleDocumentIds: expect.any(Set),
    });
  });

  it('resolves names server-side, unions them with explicit ids, and echoes searchedFor', async () => {
    mockGetGraphNodeNames.mockResolvedValue([
      { id: 'entity-1', name: 'Shield AI', kind: 'entity', found: true },
      { id: 'bogus-id', name: null, kind: null, found: false },
    ]);
    mockResolveGraphNodesByName.mockImplementation(({ kind }: { kind: string }) => (
      kind === 'entity'
        ? Promise.resolve([{ name: 'Shield AI', ids: ['entity-1', 'entity-sibling'] }])
        : Promise.resolve([{ name: 'Zero Trust', ids: [] }])
    ));

    const result = await callSearchConversations({
      ...searchArgs,
      query: '   ',
      entityIds: '["entity-1", "bogus-id"]',
      entityNames: '["Shield AI"]',
      conceptNames: '["Zero Trust"]',
    }) as Record<string, unknown>;

    expect(mockResolveGraphNodesByName).toHaveBeenCalledWith({
      names: ['Shield AI'],
      kind: 'entity',
      accessibleDocumentIds: expect.any(Set),
    });
    expect(mockResolveGraphNodesByName).toHaveBeenCalledWith({
      names: ['Zero Trust'],
      kind: 'concept',
      accessibleDocumentIds: expect.any(Set),
    });
    expect(mockGetConversationsForEntities).toHaveBeenCalledWith({
      userId: 'user-1',
      ids: ['entity-1', 'bogus-id', 'entity-sibling'],
      accessibleDocumentIds: expect.any(Set),
    });
    expect(result.searchedFor).toEqual([
      { id: 'entity-1', name: 'Shield AI', kind: 'entity', found: true },
      { id: 'bogus-id', found: false, notice: 'id not found in your graph' },
      { name: 'Shield AI', kind: 'entity', matchedNodes: 2, found: true },
      { name: 'Zero Trust', kind: 'concept', matchedNodes: 0, found: false },
    ]);
  });

  it('triggers entity matching from names alone, without any explicit ids', async () => {
    mockResolveGraphNodesByName.mockImplementation(({ kind }: { kind: string }) => (
      kind === 'entity'
        ? Promise.resolve([{ name: 'Shield AI', ids: ['entity-9'] }])
        : Promise.resolve([])
    ));

    await callSearchConversations({
      ...searchArgs,
      query: '   ',
      entityNames: '["Shield AI"]',
    });

    expect(mockGetConversationsForEntities).toHaveBeenCalledWith({
      userId: 'user-1',
      ids: ['entity-9'],
      accessibleDocumentIds: expect.any(Set),
    });
  });

  it('deduplicates repeated ids and names before every lookup', async () => {
    mockGetGraphNodeNames.mockResolvedValue([
      { id: 'entity-1', name: 'Shield AI', kind: 'entity', found: true },
    ]);
    mockResolveGraphNodesByName.mockImplementation(({ kind }: { kind: string }) => (
      kind === 'entity'
        ? Promise.resolve([{ name: 'Shield AI', ids: [] }])
        : Promise.resolve([])
    ));

    const result = await callSearchConversations({
      ...searchArgs,
      query: '   ',
      entityIds: '["entity-1", "entity-1"]',
      conceptIds: '["entity-1"]',
      entityNames: '["Shield AI", "Shield AI"]',
    }) as Record<string, unknown>;

    expect(mockGetGraphNodeNames).toHaveBeenCalledWith({
      ids: ['entity-1'],
      accessibleDocumentIds: expect.any(Set),
    });
    expect(mockResolveGraphNodesByName).toHaveBeenCalledWith({
      names: ['Shield AI'],
      kind: 'entity',
      accessibleDocumentIds: expect.any(Set),
    });
    expect(mockGetConversationsForEntities).toHaveBeenCalledWith({
      userId: 'user-1',
      ids: ['entity-1'],
      accessibleDocumentIds: expect.any(Set),
    });
    expect(result.searchedFor).toEqual([
      { id: 'entity-1', name: 'Shield AI', kind: 'entity', found: true },
      { name: 'Shield AI', kind: 'entity', matchedNodes: 0, found: false },
    ]);
  });

  it('keeps text results and reports entityLookupError when the entity lookup fails', async () => {
    mockSearchChatMessages.mockResolvedValue([{
      messageId: 'message-1',
      chatId: 'chat-1',
      chatSummary: 'Prior chat',
      role: 'user',
      text: 'Verbatim text hit',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      similarity: null,
      textRank: 0.5,
    }]);
    mockGetConversationsForEntities.mockRejectedValue(
      new Error('Error finding conversations for entities'),
    );

    const result = await callSearchConversations({
      ...searchArgs,
      entityIds: '["entity-1"]',
    }) as Record<string, unknown>;

    expect(result).not.toHaveProperty('error');
    expect((result.results as unknown[]).length).toBe(1);
    expect(result.entityLookupError).toBe('Error finding conversations for entities');
    expect(result).not.toHaveProperty('entityMatches');
  });

  it('replaces unexpected entity-lookup failures with a generic message', async () => {
    mockGetConversationsForEntities.mockRejectedValue(new Error('Neo4j password'));

    const result = await callSearchConversations({
      ...searchArgs,
      entityIds: '["entity-1"]',
    }) as Record<string, unknown>;

    expect(result.entityLookupError).toBe('Error matching conversations by entity');
  });

  it('rejects filter lists over the configured limit before any lookup', async () => {
    const tooMany = JSON.stringify(
      Array.from({ length: CONVERSATION_ENTITY_FILTER_LIMIT + 1 }, (_, i) => `entity-${i}`),
    );

    await expect(callSearchConversations({
      ...searchArgs,
      entityIds: tooMany,
    })).resolves.toEqual({
      error: `Too many entity filters: ${CONVERSATION_ENTITY_FILTER_LIMIT + 1} given, limit is ${CONVERSATION_ENTITY_FILTER_LIMIT}`,
    });

    expect(mockSearchChatMessages).not.toHaveBeenCalled();
    expect(mockGetGraphNodeNames).not.toHaveBeenCalled();
    expect(mockGetConversationsForEntities).not.toHaveBeenCalled();
  });

  it('ignores whitespace-only entries in id and name filters', async () => {
    await expect(callSearchConversations({
      ...searchArgs,
      query: '   ',
      entityIds: '["", "  "]',
      entityNames: '[""]',
    })).resolves.toEqual({ results: [], nextCursor: null });

    expect(mockGetGraphNodeNames).not.toHaveBeenCalled();
    expect(mockResolveGraphNodesByName).not.toHaveBeenCalled();
    expect(mockGetConversationsForEntities).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', { entityIds: '{' }, 'Invalid entityIds'],
    ['a non-array value', { conceptIds: 'null' }, 'Invalid conceptIds'],
    ['an array containing non-strings', { entityIds: '["entity-1", 2]' }, 'Invalid entityIds'],
    ['malformed entity names', { entityNames: '{' }, 'Invalid entityNames'],
    ['non-string concept names', { conceptNames: '[1]' }, 'Invalid conceptNames'],
  ])('rejects %s in graph target IDs', async (_label, invalidArgs, error) => {
    await expect(callSearchConversations({
      ...searchArgs,
      ...invalidArgs,
    })).resolves.toEqual({ error });

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockSearchChatMessages).not.toHaveBeenCalled();
    expect(mockGetConversationsForEntities).not.toHaveBeenCalled();
  });

  it.each([
    [callSearchConversations, { ...searchArgs, cursor: '-1' }, 'Invalid cursor'],
    [
      callGetRecentConversations,
      { userId: 'user-1', chatId: 'chat-current', cursor: '1.5' },
      'Invalid cursor',
    ],
    [
      callGetRecentConversations,
      { userId: 'user-1', chatId: 'chat-current', sinceDays: '0' },
      'Invalid sinceDays',
    ],
    [
      callGetConversationMessages,
      { userId: 'user-1', chatId: 'chat-1', startPosition: '-1' },
      'Invalid position',
    ],
    [
      callGetConversationMessages,
      { userId: 'user-1', chatId: 'chat-1', endPosition: 'abc' },
      'Invalid position',
    ],
    [
      callFindArtifacts,
      { userId: 'user-1', sinceDays: '0' },
      'Invalid sinceDays',
    ],
    [
      callFindArtifacts,
      { userId: 'user-1', cursor: '-1' },
      'Invalid cursor',
    ],
  ])('returns validation errors without calling DALs', async (handler, args, error) => {
    await expect(handler(args)).resolves.toEqual({ error });

    expect(mockSearchChatMessages).not.toHaveBeenCalled();
    expect(mockGetRecentConversations).not.toHaveBeenCalled();
    expect(mockGetConversationMessages).not.toHaveBeenCalled();
    expect(mockFindArtifacts).not.toHaveBeenCalled();
  });

  it('finds artifacts with optional filters and passes the parsed cursor through', async () => {
    const results = [{ id: 'artifact-1' }];
    mockFindArtifacts.mockResolvedValue(results);

    await expect(callFindArtifacts({
      userId: ' user-1 ',
      label: ' Quarterly Plan ',
      fileExtension: ' docx ',
      sinceDays: '30',
      cursor: '20',
    })).resolves.toEqual({ results, nextCursor: null });

    expect(mockFindArtifacts).toHaveBeenCalledWith({
      userId: 'user-1',
      label: 'Quarterly Plan',
      fileExtension: 'docx',
      sinceDays: 30,
      cursor: 20,
    });
  });

  it('emits the next artifact-search offset for a full page', async () => {
    const results = Array.from(
      { length: ARTIFACT_SEARCH_PAGE_SIZE },
      (_, index) => ({ id: `artifact-${index}` }),
    );
    mockFindArtifacts.mockResolvedValue(results);

    await expect(callFindArtifacts({
      userId: 'user-1',
      cursor: '40',
    })).resolves.toEqual({
      results,
      nextCursor: '60',
    });
    expect(mockFindArtifacts).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: 40,
    });
  });

  it('sanitizes artifact-search failures', async () => {
    mockFindArtifacts.mockRejectedValue(new Error('private database details'));

    await expect(callFindArtifacts({ userId: 'user-1' })).resolves.toEqual({
      error: 'Error finding artifacts',
    });
  });

  it('gets recent conversations with defaults and emits a full-page cursor', async () => {
    const conversations = Array.from({ length: 20 }, (_, index) => ({
      chatId: `chat-${index}`,
    }));
    mockGetRecentConversations.mockResolvedValue(conversations);

    await expect(callGetRecentConversations({
      userId: 'user-1',
      chatId: 'chat-current',
    })).resolves.toEqual({
      conversations,
      nextCursor: '20',
    });
    expect(mockGetRecentConversations).toHaveBeenCalledWith({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
      offset: 0,
      excludeChatId: 'chat-current',
    });
  });

  it('passes an empty current chat ID through without rejecting it', async () => {
    await expect(callGetRecentConversations({
      userId: 'user-1',
      chatId: '',
    })).resolves.toEqual({ conversations: [], nextCursor: null });

    expect(mockGetRecentConversations).toHaveBeenCalledWith({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
      offset: 0,
      excludeChatId: '',
    });
  });

  it('gets a position window and surfaces a sanitized not-found error', async () => {
    const window = {
      chatId: 'chat-1',
      title: 'Prior chat',
      messageCount: 3,
      messages: [{ messageId: 'message-2', position: 1 }],
    };
    mockGetConversationMessages.mockResolvedValueOnce(window);

    await expect(callGetConversationMessages({
      userId: 'user-1',
      chatId: 'chat-1',
      startPosition: '1',
      endPosition: '2',
    })).resolves.toEqual(window);
    expect(mockGetConversationMessages).toHaveBeenCalledWith({
      userId: 'user-1',
      chatId: 'chat-1',
      startPosition: 1,
      endPosition: 2,
    });

    mockGetConversationMessages.mockRejectedValueOnce(new Error('Conversation not found'));
    await expect(callGetConversationMessages({
      userId: 'user-1',
      chatId: 'missing-chat',
    })).resolves.toEqual({ error: 'Conversation not found' });
  });

  it('validates and fetches a conversation artifact with its cursor', async () => {
    await expect(callGetConversationArtifact({
      userId: 'user-1',
    })).resolves.toEqual({ error: 'Artifact ID is required' });
    await expect(callGetConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
      cursor: '-1',
    })).resolves.toEqual({ error: 'Invalid cursor' });

    await callGetConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
      cursor: '30000',
    });

    expect(mockGetConversationArtifact).toHaveBeenCalledTimes(1);
    expect(mockGetConversationArtifact).toHaveBeenCalledWith({
      userId: 'user-1',
      artifactId: 'artifact-1',
      cursor: 30000,
    });
  });

  it('surfaces allowlisted artifact errors and sanitizes unexpected errors', async () => {
    mockGetConversationArtifact.mockRejectedValueOnce(new Error('Artifact not found'));
    await expect(callGetConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-missing',
    })).resolves.toEqual({ error: 'Artifact not found' });

    mockGetConversationArtifact.mockRejectedValueOnce(new Error('private details'));
    await expect(callGetConversationArtifact({
      userId: 'user-1',
      artifactId: 'artifact-1',
    })).resolves.toEqual({ error: 'Error fetching conversation artifact' });
  });

  it('registers all five tool definitions and handlers with the required fields', () => {
    const expectations = [
      ['search_conversations', ['userId', 'query', 'chatId'], [
        'userId', 'query', 'chatId', 'cursor', 'entityIds', 'conceptIds',
        'entityNames', 'conceptNames',
      ]],
      [
        'get_recent_conversations',
        ['userId', 'chatId'],
        ['userId', 'chatId', 'sinceDays', 'cursor'],
      ],
      ['get_conversation_messages', ['userId', 'chatId'], [
        'userId', 'chatId', 'startPosition', 'endPosition',
      ]],
      ['find_artifacts', ['userId'], [
        'userId', 'label', 'fileExtension', 'sinceDays', 'cursor',
      ]],
      ['get_conversation_artifact', ['userId', 'artifactId'], [
        'userId', 'artifactId', 'cursor',
      ]],
    ] as const;

    expectations.forEach(([name, required, properties]) => {
      const tool = TOOLS.find((candidate) => candidate.name === name);
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toEqual(required);
      expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(properties);
      expect(TOOL_HANDLERS[name]).toEqual(expect.any(Function));
    });
  });
});

describe('callSearch attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbedContent.mockResolvedValue({ embeddings: [{ embedding: [0.1, 0.2] }] } as Awaited<ReturnType<typeof embedContent>>);
    mockGetEmbeddings.mockResolvedValue([]);
    mockGetAccessible.mockResolvedValue(new Set() as unknown as Awaited<ReturnType<typeof getAccessibleDocumentIds>>);
    mockBuildKnowledgeGraphSource.mockResolvedValue({ source: {}, model: {} });
    mockExtractSearchTerms.mockResolvedValue({ terms: [] });
    mockHybridEntitySearch.mockResolvedValue([]);
    mockHybridConceptSearch.mockResolvedValue([]);
    mockScoreGapFilter.mockImplementation((items) => items);
    mockFilterAnchorsForRelevance.mockResolvedValue({ chunks: [], entities: [], concepts: [] });
  });

  it('attributes the query embedding to the chat message that caused it', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      chatMessageId: CHAT_MESSAGE_ID,
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      { chatMessageId: CHAT_MESSAGE_ID, stepLabel: 'query embedding' },
      undefined,
    );
  });

  it('omits attribution when the chat message id is not a valid id', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      chatMessageId: 'msg-1',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
      undefined,
    );
  });

  it('omits attribution when no chat message id is supplied', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
      undefined,
    );
  });

  it('omits attribution when the chat message id is an empty string', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      chatMessageId: '',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
      undefined,
    );
  });

  it('attributes the query embedding to the selected user group', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'false',
      userGroupId: 'group-1',
    });

    expect(mockEmbedContent).toHaveBeenCalledWith(
      'what does the contract say',
      'user-1',
      undefined,
      undefined,
      'group-1',
    );
  });

  it('passes the selected user group to the knowledge-graph AI factory in graph mode', async () => {
    await callSearch({
      userId: 'user-1',
      query: 'what does the contract say',
      documentIds: '["doc-1"]',
      useGraph: 'true',
      userGroupId: 'group-1',
    });

    expect(AIFactory).toHaveBeenCalledWith({ userId: 'user-1', userGroupId: 'group-1' });
  });
});

describe('callAnalyzeData attribution', () => {
  const analyzeArgs = {
    userId: 'user-1',
    documentId: 'doc-1',
    question: 'what was total revenue by month',
    modelId: 'model-1',
  };

  const sentBody = (): Record<string, unknown> =>
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);

  beforeEach(() => {
    jest.clearAllMocks();
    (db.document.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      filename: 'sales.xlsx',
      text: 'month,revenue\nJan,100',
      dataProfile: null,
    });
    (db.model.findUnique as jest.Mock).mockResolvedValue({ externalId: 'claude-sonnet-4' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'Revenue was 100 in Jan', code: 'df.sum()' }),
    });
  });

  it('attributes the analysis agent to the chat message that caused it', async () => {
    await callAnalyzeData({ ...analyzeArgs, chatMessageId: CHAT_MESSAGE_ID });

    expect(sentBody().chat_message_id).toBe(CHAT_MESSAGE_ID);
  });

  it('omits attribution when the chat message id is not a valid id', async () => {
    await callAnalyzeData({ ...analyzeArgs, chatMessageId: 'msg-1' });

    expect(sentBody().chat_message_id).toBeNull();
  });

  it('omits attribution when no chat message id is supplied', async () => {
    await callAnalyzeData(analyzeArgs);

    expect(sentBody().chat_message_id).toBeNull();
  });

  it('omits attribution when the chat message id is an empty string', async () => {
    await callAnalyzeData({ ...analyzeArgs, chatMessageId: '' });

    expect(sentBody().chat_message_id).toBeNull();
  });

  it('attributes the analysis agent to the selected user group', async () => {
    await callAnalyzeData({ ...analyzeArgs, userGroupId: 'group-1' });

    expect(sentBody().user_group_id).toBe('group-1');
  });

  it('omits the user group when none is supplied', async () => {
    await callAnalyzeData(analyzeArgs);

    expect(sentBody().user_group_id).toBeNull();
  });
});
