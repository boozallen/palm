import db from '@/server/db';
import logger from '@/server/logger';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import getUsageRecords from './getUsageRecords';

// Explicit stubs rather than an automock: the time-range bound is composed through
// Prisma.sql/raw, and an automock returns undefined for both, which makes the
// emitted SQL unassertable.
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
  aiProvider: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  model: {
    findUnique: jest.fn(),
  },
}));

jest.mock('@/features/settings/dal/user-groups/getUserGroup');

describe('getUsageRecords', () => {
  const mockAiProviderId = '2db90cb6-ecbc-47d8-b260-bd09b2c7cbd1';
  const mockAiProviderLabel = 'OpenAI';
  const mockInitiatedBy = InitiatedBy.Any;

  const mockModelId = 'all';
  const mockModelLabel = undefined;
  const mockTimeRange = TimeRange.Day;

  const mockProviderId = '8c852dec-ea46-4f63-a980-e52ba9ca9a54';
  const mockModelOneId = '413e3d33-c06c-4dba-a391-1481dc2f41ef';
  const mockModelTwoId = 'b4513ace-5d28-48e1-a660-941cac060747';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return usage records with total cost and providers', async () => {
    const mockRawRecords = [
      {
        aiProviderId: mockProviderId,
        aiProviderLabel: 'Provider 1',
        providerTotalCost: 110,
        providerTotalInputTokens: 1000000,
        providerTotalOutputTokens: 500000,
        modelId: mockModelOneId,
        modelLabel: 'Model 1',
        modelTotalCost: 50,
        modelTotalInputTokens: 600000,
        modelTotalOutputTokens: 300000,
        overallTotalCost: 110,
        overallTotalInputTokens: 1000000,
        overallTotalOutputTokens: 500000,
      },
      {
        aiProviderId: mockProviderId,
        aiProviderLabel: 'Provider 1',
        costPerInputToken: 1.5,
        costPerOutputToken: 2,
        providerTotalCost: 110,
        providerTotalInputTokens: 1000000,
        providerTotalOutputTokens: 500000,
        modelId: mockModelTwoId,
        modelLabel: 'Model 2',
        modelTotalCost: 60,
        modelTotalInputTokens: 400000,
        modelTotalOutputTokens: 200000,
        overallTotalCost: 110,
        overallTotalInputTokens: 1000000,
        overallTotalOutputTokens: 500000,
      },
    ];

    (db.aiProvider.findUnique as jest.Mock).mockResolvedValue({ label: mockAiProviderLabel });
    (db.$queryRaw as jest.Mock).mockResolvedValue(mockRawRecords);
    (db.aiProvider.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockProviderId,
        label: 'Provider 1',
        models: [
          { id: mockModelOneId, name: 'Model 1' },
          { id: mockModelTwoId, name: 'Model 2' },
        ],
      }]);

    const result = await getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange,
      'all',
      'all',
    );

    expect(result).toEqual({
      initiatedBy: mockInitiatedBy,
      aiProvider: mockAiProviderLabel,
      model: mockModelLabel,
      timeRange: mockTimeRange,
      totalCost: mockRawRecords[0].overallTotalCost,
      totalInputTokens: mockRawRecords[0].overallTotalInputTokens,
      totalOutputTokens: mockRawRecords[0].overallTotalOutputTokens,
      providers: [
        {
          id: mockRawRecords[0].aiProviderId,
          label: mockRawRecords[0].aiProviderLabel,
          costPerInputToken: mockRawRecords[0].costPerInputToken,
          costPerOutputToken: mockRawRecords[0].costPerOutputToken,
          cost: mockRawRecords[0].providerTotalCost,
          inputTokens: mockRawRecords[0].providerTotalInputTokens,
          outputTokens: mockRawRecords[0].providerTotalOutputTokens,
          models: [
            { id: mockRawRecords[0].modelId, label: mockRawRecords[0].modelLabel, cost: mockRawRecords[0].modelTotalCost, inputTokens: mockRawRecords[0].modelTotalInputTokens, outputTokens: mockRawRecords[0].modelTotalOutputTokens },
            { id: mockRawRecords[1].modelId, label: mockRawRecords[1].modelLabel, cost: mockRawRecords[1].modelTotalCost, inputTokens: mockRawRecords[1].modelTotalInputTokens, outputTokens: mockRawRecords[1].modelTotalOutputTokens },
          ],
        },
      ],
    });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should return records with 0 cost if no records are found', async () => {
    (db.aiProvider.findUnique as jest.Mock).mockResolvedValue({ label: mockAiProviderLabel });
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);
    (db.aiProvider.findMany as jest.Mock).mockResolvedValue([
      {
        id: mockProviderId,
        label: 'Provider 1',
        models: [
          { id: mockModelOneId, name: 'Model 1' },
          { id: mockModelTwoId, name: 'Model 2' },
        ],
      }]);

    const result = await getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange,
      'all',
      'all',
    );

    expect(result).toEqual({
      initiatedBy: mockInitiatedBy,
      aiProvider: mockAiProviderLabel,
      model: undefined,
      timeRange: mockTimeRange,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      providers: [
        {
          id: mockProviderId,
          label: 'Provider 1',
          costPerInputToken: undefined,
          costPerOutputToken: undefined,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          models: [
            { id: mockModelOneId, label: 'Model 1', cost: 0, inputTokens: 0, outputTokens: 0 },
            { id: mockModelTwoId, label: 'Model 2', cost: 0, inputTokens: 0, outputTokens: 0 },
          ],
        },
      ],
    });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if the query returns null', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue(null);

    await expect(getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange,
      'all',
      'all',
    )).rejects.toThrow(
      'Error fetching usage records'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching usage records',
      new Error('Unexpected null result from database query.')
    );
  });

  it('should throw an error if total cost is null', async () => {
    const mockRawRecords = [
      {
        aiProviderId: mockProviderId,
        aiProviderLabel: 'Provider 1',
        providerTotalCost: 100,
        modelId: mockModelOneId,
        modelLabel: 'Model 1',
        modelTotalCost: 50,
        overallTotalCost: null,
      },
    ];

    (db.$queryRaw as jest.Mock).mockResolvedValue(mockRawRecords);

    await expect(getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange,
      'all',
      'all',
    )).rejects.toThrow(
      'Error fetching usage records'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching usage records',
      new Error('Total cost was unexpectedly null.')
    );
  });

  it('should log and throw an error if the query fails', async () => {
    const mockError = new Error('Database query failed');
    (db.$queryRaw as jest.Mock).mockRejectedValue(mockError);

    await expect(getUsageRecords(
      mockInitiatedBy,
      mockAiProviderId,
      mockModelId,
      mockTimeRange,
      'all',
      'all',
    )).rejects.toThrow(
      'Error fetching usage records'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching usage records',
      mockError
    );
  });

  describe('time range bounds', () => {
    type MockFragment = { strings: TemplateStringsArray; values: unknown[] };

    const isFragment = (value: unknown): value is MockFragment =>
      typeof value === 'object' && value !== null && 'strings' in value;

    const render = (value: unknown): string => {
      if (isFragment(value)) {
        return value.strings
          .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
          .join('');
      }
      if (typeof value === 'symbol') { return ''; }

      return String(value);
    };

    beforeEach(() => {
      (db.aiProvider.findMany as jest.Mock).mockResolvedValue([]);
      (db.$queryRaw as jest.Mock).mockResolvedValue([]);
    });

    const whereClauseFor = async (timeRange: TimeRange) => {
      await getUsageRecords(InitiatedBy.Any, 'all', 'all', timeRange, 'all', 'all');

      const values = (db.$queryRaw as jest.Mock).mock.calls[0].slice(1);

      return values.map(render).join('\n');
    };

    // Asserted exclusively: the clause this replaced listed every window as an OR
    // branch gated on a bound parameter, so a plain toContain matched all four
    // regardless of which preset was requested. Naming the bounds the clause must
    // NOT contain is what makes these cases capable of failing.
    const BOUNDS: Record<string, string> = {
      [TimeRange.Day]: 'NOW() - INTERVAL \'24 hours\'',
      [TimeRange.Week]: 'NOW() - INTERVAL \'7 days\'',
      [TimeRange.Month]: 'NOW() - INTERVAL \'30 days\'',
      [TimeRange.Year]: 'NOW() - INTERVAL \'365 days\'',
      [TimeRange.YearToDate]: 'date_trunc(\'year\', NOW())',
    };

    it.each(Object.keys(BOUNDS))('bounds %s to that window and no other', async (timeRange) => {
      const clause = await whereClauseFor(timeRange as TimeRange);

      expect(clause).toContain(`"apu"."timestamp" >= ${BOUNDS[timeRange]}`);

      Object.entries(BOUNDS)
        .filter(([preset]) => preset !== timeRange)
        .forEach(([, bound]) => {
          expect(clause).not.toContain(bound);
        });
    });

    // Neither preset existed in the Analytics display-string enum this DAL was
    // typed against, so both are new capability rather than a migration.
    it('applies no time bound for the forever range', async () => {
      const clause = await whereClauseFor(TimeRange.Forever);

      expect(clause).not.toContain('INTERVAL');
      expect(clause).toContain('"ap"."deletedAt" IS NULL');
    });

    it('keeps the soft-delete guards on every preset', async () => {
      const clause = await whereClauseFor(TimeRange.Day);

      expect(clause).toContain('"ap"."deletedAt" IS NULL');
      expect(clause).toContain('"m"."deletedAt" IS NULL');
    });
  });

  describe('initiatedBy filtering', () => {
    // Jest loads the browser build of Prisma, so the Prisma.sql tag is
    // automocked. A real implementation is substituted here so the assembled
    // WHERE clause can be read back as text.
    const originalSql = Prisma.sql;

    beforeEach(() => {
      (Prisma.sql as unknown) = jest.fn(
        (strings: TemplateStringsArray, ...values: unknown[]) => {
          let text = strings[0];
          values.forEach((value, index) => {
            const rendered =
              value && typeof value === 'object' && 'text' in value
                ? (value as { text: string }).text
                : String(value ?? '');
            text += rendered + strings[index + 1];
          });
          return { text };
        },
      );

      (db.aiProvider.findUnique as jest.Mock).mockResolvedValue({ label: mockAiProviderLabel });
      (db.aiProvider.findMany as jest.Mock).mockResolvedValue([]);
      (db.$queryRaw as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
      (Prisma.sql as unknown) = originalSql;
    });

    const whereClauseTextFor = async (initiatedBy: InitiatedBy) => {
      await getUsageRecords(initiatedBy, mockAiProviderId, mockModelId, mockTimeRange, 'all', 'all');

      const values = (db.$queryRaw as jest.Mock).mock.calls[0].slice(1);
      const clause = values.find(
        (value: unknown) =>
          !!value && typeof value === 'object' && 'text' in (value as object),
      ) as { text: string };

      return clause.text;
    };

    it('should exclude embedding spend from user-initiated usage', async () => {
      const text = await whereClauseTextFor(InitiatedBy.User);

      expect(text).toContain('"apu"."embedding" = FALSE');
      expect(text).toContain('"apu"."system" = FALSE');
      expect(text).toContain('"apu"."agent" = FALSE');
      expect(text).toContain('"apu"."knowledgeGraph" = FALSE');
    });

    it('should filter to embedding spend only when Embedding is selected', async () => {
      const text = await whereClauseTextFor(InitiatedBy.Embedding);

      expect(text).toContain('"apu"."embedding" = TRUE');
    });

    it('should not filter on the embedding flag for Any', async () => {
      const text = await whereClauseTextFor(InitiatedBy.Any);

      expect(text).not.toContain('"apu"."embedding"');
    });
  });
});
