import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import getAgentServiceStats from './getAgentServiceStats';
import { TimeRange } from '@/features/context-studio/types/context-studio';

// Jest resolves @prisma/client to the browser build, where `Prisma.sql` and
// `Prisma.raw` throw on sight. Stub just those two so the composed time-range and
// user filters are reachable; everything else (notably `Prisma.DbNull`) stays real.
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');

  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
      })),
      raw: jest.fn((value: string) => value),
      empty: Symbol('empty'),
    },
  };
});

jest.mock('@/server/db', () => mockDeep<PrismaClient>());
jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import db from '@/server/db';

const mockDb = db as jest.Mocked<PrismaClient>;

describe('getAgentServiceStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The tool-call rollup reads threads through a Prisma WhereInput rather than raw
  // SQL, so its lower bound has to be resolved as a JS Date. It is the only place
  // in this DAL where the time range is not expressed as a SQL interval.
  describe('agentThread tool-call cutoff', () => {
    const NOW = new Date('2026-08-18T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
      (mockDb.$queryRaw as jest.Mock).mockResolvedValue([]);
      (mockDb.agentThread.findMany as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const capturedWhere = (): Record<string, unknown> =>
      (mockDb.agentThread.findMany as jest.Mock).mock.calls[0][0].where;

    it.each([
      [TimeRange.Day, '2026-08-17T12:00:00.000Z'],
      [TimeRange.Week, '2026-08-11T12:00:00.000Z'],
      [TimeRange.Month, '2026-07-19T12:00:00.000Z'],
      [TimeRange.Year, '2025-08-18T12:00:00.000Z'],
      [TimeRange.YearToDate, '2026-01-01T00:00:00.000Z'],
    ])('bounds %s at %s', async (timeRange, expected) => {
      await getAgentServiceStats(timeRange, 'all', 'all');

      expect(capturedWhere().createdAt).toEqual({ gte: new Date(expected) });
    });

    it('applies no lower bound for the forever range', async () => {
      await getAgentServiceStats(TimeRange.Forever, 'all', 'all');

      expect(capturedWhere()).not.toHaveProperty('createdAt');
    });
  });

  it('should return agent service stats for all users and all time', async () => {
    (mockDb.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ count: BigInt(20) }]) // totalThreads
      .mockResolvedValueOnce([
        { status: 'completed', count: BigInt(12) },
        { status: 'interrupted', count: BigInt(6) },
        { status: 'cancelled', count: BigInt(1) },
        { status: 'running', count: BigInt(1) },
      ]) // threadsByStatus
      .mockResolvedValueOnce([
        { graphType: 'code_analysis', count: BigInt(7) },
        { graphType: 'data_processing', count: BigInt(4) },
        { graphType: 'document_review', count: BigInt(4) },
        { graphType: 'api_design', count: BigInt(3) },
        { graphType: 'test_generation', count: BigInt(2) },
      ]) // threadsByGraphType
      .mockResolvedValueOnce([{ count: BigInt(15) }]) // chatsWithAgentProvider
      .mockResolvedValueOnce([
        { provider: 'Code Review Agent', count: BigInt(3) },
        { provider: 'LangChain Development Agent', count: BigInt(3) },
        { provider: 'Documentation Agent', count: BigInt(3) },
        { provider: 'Testing Agent', count: BigInt(3) },
        { provider: 'Data Analysis Agent', count: BigInt(3) },
      ]); // chatsByAgentProvider

    (mockDb.agentThread.findMany as jest.Mock).mockResolvedValue([
      {
        result: {
          tool_calls: [
            { name: 'read_file' },
            { name: 'write_file' },
          ],
        },
      },
      {
        result: {
          messages: [
            {
              tool_calls: [
                { name: 'execute_code' },
                { function: { name: 'search_code' } },
              ],
            },
          ],
        },
      },
    ] as any);

    const result = await getAgentServiceStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalThreads).toBe(20);
    expect(result.threadsByStatus).toEqual([
      { status: 'completed', count: 12 },
      { status: 'interrupted', count: 6 },
      { status: 'cancelled', count: 1 },
      { status: 'running', count: 1 },
    ]);
    expect(result.threadsByGraphType).toEqual([
      { graphType: 'code_analysis', count: 7 },
      { graphType: 'data_processing', count: 4 },
      { graphType: 'document_review', count: 4 },
      { graphType: 'api_design', count: 3 },
      { graphType: 'test_generation', count: 2 },
    ]);
    expect(result.chatsWithAgentProvider).toBe(15);
    expect(result.chatsByAgentProvider).toEqual([
      { provider: 'Code Review Agent', count: 3 },
      { provider: 'LangChain Development Agent', count: 3 },
      { provider: 'Documentation Agent', count: 3 },
      { provider: 'Testing Agent', count: 3 },
      { provider: 'Data Analysis Agent', count: 3 },
    ]);
    expect(result.totalToolCalls).toBe(4);
    expect(result.toolCallsByType).toEqual([
      { toolType: 'read_file', count: 1 },
      { toolType: 'write_file', count: 1 },
      { toolType: 'execute_code', count: 1 },
      { toolType: 'search_code', count: 1 },
    ]);
  });

  it('should handle empty results gracefully', async () => {
    (mockDb.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    (mockDb.agentThread.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getAgentServiceStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalThreads).toBe(0);
    expect(result.threadsByStatus).toEqual([]);
    expect(result.threadsByGraphType).toEqual([]);
    expect(result.chatsWithAgentProvider).toBe(0);
    expect(result.chatsByAgentProvider).toEqual([]);
    expect(result.totalToolCalls).toBe(0);
    expect(result.toolCallsByType).toEqual([]);
  });

  it('should correctly parse tool calls from thread results', async () => {
    (mockDb.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ count: BigInt(3) }])
      .mockResolvedValueOnce([{ status: 'completed', count: BigInt(3) }])
      .mockResolvedValueOnce([{ graphType: 'code_analysis', count: BigInt(3) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    (mockDb.agentThread.findMany as jest.Mock).mockResolvedValue([
      {
        result: {
          tool_calls: [
            { name: 'read_file' },
            { name: 'read_file' },
            { name: 'write_file' },
          ],
        },
      },
      {
        result: {
          messages: [
            {
              tool_calls: [
                { name: 'execute_code' },
              ],
            },
            {
              tool_calls: [
                { function: { name: 'search_code' } },
                { function: { name: 'search_code' } },
              ],
            },
          ],
        },
      },
      {
        result: {
          tool_calls: [
            { name: 'analyze_spreadsheet_data' },
          ],
          messages: [
            {
              tool_calls: [
                { name: 'generate_chart' },
              ],
            },
          ],
        },
      },
    ] as any);

    const result = await getAgentServiceStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalToolCalls).toBe(8);
    expect(result.toolCallsByType).toEqual([
      { toolType: 'read_file', count: 2 },
      { toolType: 'search_code', count: 2 },
      { toolType: 'write_file', count: 1 },
      { toolType: 'execute_code', count: 1 },
      { toolType: 'analyze_spreadsheet_data', count: 1 },
      { toolType: 'generate_chart', count: 1 },
    ]);
  });

  it('should handle malformed tool calls gracefully', async () => {
    (mockDb.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ count: BigInt(2) }])
      .mockResolvedValueOnce([{ status: 'completed', count: BigInt(2) }])
      .mockResolvedValueOnce([{ graphType: 'code_analysis', count: BigInt(2) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    (mockDb.agentThread.findMany as jest.Mock).mockResolvedValue([
      {
        result: {
          tool_calls: [
            { name: 'read_file' },
            null, // Invalid - skipped
            { invalid: 'object' }, // No name - skipped (top-level tool_calls requires 'name')
          ],
        },
      },
      {
        result: {
          messages: [
            {
              tool_calls: [
                { name: 'write_file' },
                { function: null }, // Invalid function - counts as 'unknown'
              ],
            },
          ],
        },
      },
    ] as any);

    const result = await getAgentServiceStats(TimeRange.Forever, 'all', 'all');

    // read_file + write_file + unknown = 3
    expect(result.totalToolCalls).toBe(3);
    expect(result.toolCallsByType).toEqual([
      { toolType: 'read_file', count: 1 },
      { toolType: 'write_file', count: 1 },
      { toolType: 'unknown', count: 1 },
    ]);
  });

  it('should handle thread results without tool_calls', async () => {
    (mockDb.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ count: BigInt(2) }])
      .mockResolvedValueOnce([{ status: 'completed', count: BigInt(2) }])
      .mockResolvedValueOnce([{ graphType: 'code_analysis', count: BigInt(2) }])
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    (mockDb.agentThread.findMany as jest.Mock).mockResolvedValue([
      {
        result: {
          status: 'completed',
          output: 'Success',
        },
      },
      {
        result: {
          messages: [
            {
              role: 'assistant',
              content: 'Response without tool calls',
            },
          ],
        },
      },
    ] as any);

    const result = await getAgentServiceStats(TimeRange.Forever, 'all', 'all');

    expect(result.totalToolCalls).toBe(0);
    expect(result.toolCallsByType).toEqual([]);
  });

  it('should throw error on database failure', async () => {
    (mockDb.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    await expect(
      getAgentServiceStats(TimeRange.Forever, 'all', 'all')
    ).rejects.toThrow('Failed to fetch agent service statistics');
  });
});
