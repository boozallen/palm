import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import getConversationToolStats from './getConversationToolStats';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/server/db', () => mockDeep<PrismaClient>());
jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import db from '@/server/db';

const mockDb = db as jest.Mocked<PrismaClient>;

const toolCallEvent = (toolName: string) => JSON.stringify({ type: 'tool_call', toolName });
const subagentToolCallEvent = (tool: string) => JSON.stringify({ type: 'subagent_tool_call', tool });

describe('getConversationToolStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chatMessage createdAt cutoff', () => {
    const NOW = new Date('2026-08-18T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
      (mockDb.chatMessage.findMany as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const capturedWhere = (): Record<string, unknown> =>
      (mockDb.chatMessage.findMany as jest.Mock).mock.calls[0][0].where;

    it.each([
      [TimeRange.Day, '2026-08-17T12:00:00.000Z'],
      [TimeRange.Week, '2026-08-11T12:00:00.000Z'],
      [TimeRange.Month, '2026-07-19T12:00:00.000Z'],
      [TimeRange.Year, '2025-08-18T12:00:00.000Z'],
      [TimeRange.YearToDate, '2026-01-01T00:00:00.000Z'],
    ])('bounds %s at %s', async (timeRange, expected) => {
      await getConversationToolStats(timeRange, 'all', 'all');

      expect(capturedWhere().createdAt).toEqual({ gte: new Date(expected) });
    });

    it('applies no lower bound for the forever range', async () => {
      await getConversationToolStats(TimeRange.Forever, 'all', 'all');

      expect(capturedWhere()).not.toHaveProperty('createdAt');
    });
  });

  describe('scoping', () => {
    beforeEach(() => {
      (mockDb.chatMessage.findMany as jest.Mock).mockResolvedValue([]);
    });

    const capturedChatWhere = (): Record<string, unknown> =>
      (mockDb.chatMessage.findMany as jest.Mock).mock.calls[0][0].where.chat;

    it('filters by a specific user id', async () => {
      await getConversationToolStats(TimeRange.Forever, 'all', 'user-1');

      expect(capturedChatWhere()).toEqual({ userId: 'user-1' });
    });

    it('filters by a specific user group', async () => {
      await getConversationToolStats(TimeRange.Forever, 'group-1', 'all');

      expect(capturedChatWhere()).toEqual({
        user: { userGroupMemberhip: { some: { userGroupId: 'group-1' } } },
      });
    });

    it('excludes admins', async () => {
      await getConversationToolStats(TimeRange.Forever, 'all', 'all', true);

      expect(capturedChatWhere()).toEqual({
        user: { role: { not: 'Admin' } },
      });
    });

    it('applies no scope filter for all users and groups', async () => {
      await getConversationToolStats(TimeRange.Forever, 'all', 'all');

      expect(capturedChatWhere()).toEqual({});
    });
  });

  it('attributes top-level tool calls to LangGraph and subagent tool calls to Claude', async () => {
    (mockDb.chatMessage.findMany as jest.Mock).mockResolvedValue([
      { progressMessages: [toolCallEvent('search'), toolCallEvent('search')] },
      { progressMessages: [subagentToolCallEvent('Read'), subagentToolCallEvent('Bash')] },
      { progressMessages: [toolCallEvent('create_docx')] },
    ]);

    const result = await getConversationToolStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalToolCalls).toBe(5);
    expect(result.byAgentService).toEqual([
      {
        agentService: 'LangGraph',
        totalToolCalls: 3,
        toolCallsByType: [
          { toolName: 'search', count: 2 },
          { toolName: 'create_docx', count: 1 },
        ],
      },
      {
        agentService: 'Claude',
        totalToolCalls: 2,
        toolCallsByType: [
          { toolName: 'Read', count: 1 },
          { toolName: 'Bash', count: 1 },
        ],
      },
    ]);
  });

  it('ignores non-tool progress events and malformed JSON', async () => {
    (mockDb.chatMessage.findMany as jest.Mock).mockResolvedValue([
      {
        progressMessages: [
          JSON.stringify({ type: 'thinking' }),
          'not json',
          toolCallEvent('search'),
        ],
      },
    ]);

    const result = await getConversationToolStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalToolCalls).toBe(1);
    expect(result.byAgentService).toEqual([
      { agentService: 'LangGraph', totalToolCalls: 1, toolCallsByType: [{ toolName: 'search', count: 1 }] },
      { agentService: 'Claude', totalToolCalls: 0, toolCallsByType: [] },
    ]);
  });

  it('handles messages with no progress messages', async () => {
    (mockDb.chatMessage.findMany as jest.Mock).mockResolvedValue([
      { progressMessages: null },
      { progressMessages: [] },
    ]);

    const result = await getConversationToolStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalToolCalls).toBe(0);
    expect(result.byAgentService).toEqual([
      { agentService: 'LangGraph', totalToolCalls: 0, toolCallsByType: [] },
      { agentService: 'Claude', totalToolCalls: 0, toolCallsByType: [] },
    ]);
  });

  it('throws an error on database failure', async () => {
    (mockDb.chatMessage.findMany as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    await expect(
      getConversationToolStats(TimeRange.Forever, 'all', 'all')
    ).rejects.toThrow('Failed to fetch conversation tool statistics');
  });
});
