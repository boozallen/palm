import getRecentConversations from '@/features/graph-database/dal/getRecentConversations';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    chatMessage: { groupBy: jest.fn() },
    chat: { findMany: jest.fn() },
  },
}));
jest.mock('@/server/logger');

const groupBy = db.chatMessage.groupBy as jest.Mock;
const findLastMessages = db.$queryRaw as jest.Mock;
const findChats = db.chat.findMany as jest.Mock;

describe('getRecentConversations', () => {
  const firstActivity = new Date('2026-08-01T10:00:00.000Z');
  const lastActivity = new Date('2026-08-05T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    groupBy.mockResolvedValue([{
      chatId: 'chat-1',
      _count: { _all: 2 },
      _min: { createdAt: firstActivity },
      _max: { createdAt: lastActivity },
    }]);
    findLastMessages.mockResolvedValue([]);
  });

  it('returns the complete activity skeleton with ranked and bounded entities', async () => {
    const fullText = `  ${'Complete final message. '.repeat(100)}\nNo truncation.  `;
    findChats.mockResolvedValue([{
      id: 'chat-1',
      summary: 'Procurement planning',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          createdAt: firstActivity,
          documentIds: ['doc-1', 'doc-2'],
          chatArtifacts: [{
            id: 'artifact-1',
            label: 'Plan',
            fileExtension: '.docx',
            createdAt: firstActivity,
          }],
          chatMessageCitations: [
            { graphEntityId: 'entity-2', graphEntity: { entityName: 'Bravo' } },
            { graphEntityId: 'entity-1', graphEntity: { entityName: 'Alpha' } },
            { graphEntityId: 'entity-3', graphEntity: { entityName: 'Charlie' } },
            { graphEntityId: 'entity-4', graphEntity: { entityName: 'Delta' } },
            { graphEntityId: 'entity-5', graphEntity: { entityName: 'Echo' } },
            { graphEntityId: 'entity-6', graphEntity: { entityName: 'Foxtrot' } },
          ],
        },
        {
          id: 'message-2',
          role: 'assistant',
          createdAt: lastActivity,
          documentIds: ['doc-2', 'doc-3'],
          chatArtifacts: [{
            id: 'artifact-2',
            label: 'Table',
            fileExtension: '.xlsx',
            createdAt: lastActivity,
          }],
          chatMessageCitations: [
            { graphEntityId: 'entity-2', graphEntity: { entityName: 'Bravo' } },
          ],
        },
      ],
    }]);
    findLastMessages.mockResolvedValue([{
      id: 'message-2',
      chatId: 'chat-1',
      role: 'assistant',
      content: fullText,
      createdAt: lastActivity,
    }]);

    const result = await getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
    });

    expect(result).toEqual([{
      chatId: 'chat-1',
      title: 'Procurement planning',
      firstActivity,
      lastActivity,
      messageCount: 2,
      documentIds: ['doc-1', 'doc-2', 'doc-3'],
      artifacts: [
        { id: 'artifact-1', label: 'Plan', fileExtension: '.docx', createdAt: firstActivity },
        { id: 'artifact-2', label: 'Table', fileExtension: '.xlsx', createdAt: lastActivity },
      ],
      topEntities: [
        { id: 'entity-2', name: 'Bravo', citationCount: 2 },
        { id: 'entity-1', name: 'Alpha', citationCount: 1 },
        { id: 'entity-3', name: 'Charlie', citationCount: 1 },
        { id: 'entity-4', name: 'Delta', citationCount: 1 },
        { id: 'entity-5', name: 'Echo', citationCount: 1 },
      ],
      lastMessage: {
        messageId: 'message-2',
        role: 'assistant',
        text: fullText,
        createdAt: lastActivity,
      },
    }]);
    expect(findChats).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        messages: expect.objectContaining({
          select: expect.not.objectContaining({ content: true }),
        }),
      }),
    }));
    expect(findLastMessages).toHaveBeenCalledTimes(1);
  });

  it('returns the preceding non-blank message when the trailing message is blank', async () => {
    const nonBlankActivity = new Date('2026-08-04T12:00:00.000Z');
    findChats.mockResolvedValue([{
      id: 'chat-1',
      summary: 'Processing response',
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          createdAt: nonBlankActivity,
          documentIds: [],
          chatArtifacts: [],
          chatMessageCitations: [],
        },
        {
          id: 'message-2',
          role: 'assistant',
          createdAt: lastActivity,
          documentIds: [],
          chatArtifacts: [],
          chatMessageCitations: [],
        },
      ],
    }]);
    findLastMessages.mockResolvedValue([{
      id: 'message-1',
      chatId: 'chat-1',
      role: 'assistant',
      content: 'Completed response',
      createdAt: nonBlankActivity,
    }]);

    const [result] = await getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
    });

    expect(result.lastActivity).toEqual(lastActivity);
    expect(result.messageCount).toBe(2);
    expect(result.lastMessage).toEqual({
      messageId: 'message-1',
      role: 'assistant',
      text: 'Completed response',
      createdAt: nonBlankActivity,
    });
  });

  it('omits a chat with no non-blank messages', async () => {
    findChats.mockResolvedValue([{
      id: 'chat-1',
      summary: 'Blank chat',
      messages: [{
        id: 'message-1',
        role: 'assistant',
        createdAt: lastActivity,
        documentIds: [],
        chatArtifacts: [],
        chatMessageCitations: [],
      }],
    }]);
    findLastMessages.mockResolvedValue([]);

    await expect(getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
    })).resolves.toEqual([]);
  });

  it('excludes the current chat from both activity and detail queries', async () => {
    findChats.mockResolvedValue([]);

    await getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
      excludeChatId: 'chat-current',
    });

    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        chat: {
          userId: 'user-1',
          id: { not: 'chat-current' },
        },
      },
    }));
    expect(findChats).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: ['chat-1'], not: 'chat-current' },
        userId: 'user-1',
      },
    }));
  });

  it('does not add a current-chat exclusion when none is provided', async () => {
    findChats.mockResolvedValue([]);

    await getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
    });

    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        chat: {
          userId: 'user-1',
        },
      },
    }));
    expect(findChats).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: ['chat-1'] },
        userId: 'user-1',
      },
    }));
  });

  it('applies the owner, last-activity window, and pagination to candidates', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-10T00:00:00.000Z').getTime());
    groupBy.mockResolvedValue([]);

    await getRecentConversations({
      userId: 'user-1',
      sinceDays: 7,
      limit: 20,
      offset: 40,
    });

    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        chat: {
          userId: 'user-1',
        },
      },
      having: {
        createdAt: {
          _max: { gte: new Date('2026-08-03T00:00:00.000Z') },
        },
      },
      take: 20,
      skip: 40,
    }));
    expect(findChats).not.toHaveBeenCalled();
  });

  it('returns an empty result without loading chat details', async () => {
    groupBy.mockResolvedValue([]);

    await expect(getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
    })).resolves.toEqual([]);

    expect(findChats).not.toHaveBeenCalled();
  });

  it('logs database failures and throws a sanitized error', async () => {
    const error = new Error('database connection string');
    groupBy.mockRejectedValue(error);

    await expect(getRecentConversations({
      userId: 'user-1',
      sinceDays: 14,
      limit: 20,
    })).rejects.toThrow('Error getting recent conversations');

    expect(logger.error).toHaveBeenCalledWith(
      'Error getting recent conversations',
      { userId: 'user-1', error },
    );
  });
});
