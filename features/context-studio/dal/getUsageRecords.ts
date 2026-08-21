import logger from '@/server/logger';
import db from '@/server/db';
import { InitiatedBy, UserGroupUsageRecord } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { Prisma } from '@prisma/client';

type ModelCosts = {
  id: string;
  label: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
};

type ProviderCosts = {
  id: string;
  label: string;
  costPerInputToken: number;
  costPerOutputToken: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  models: ModelCosts[];
};

type UsageRecords = {
  initiatedBy: InitiatedBy;
  aiProvider?: string;
  model?: string;
  timeRange: TimeRange;
  userGroupLabel?: string;
  userName?: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  providers: ProviderCosts[];
  users?: UserGroupUsageRecord[];
};

export default async function getUsageRecords(
  initiatedBy: InitiatedBy,
  aiProvider: string,
  model: string,
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<UsageRecords> {
  let aiProviderLabel: string | undefined;
  let modelLabel: string | undefined;

  // The soft-delete guards lead so the time bound can be appended as a plain AND,
  // which lets the 'forever' preset contribute Prisma.empty and drop out entirely.
  let whereClause = Prisma.sql`
    WHERE
      "ap"."deletedAt" IS NULL
      AND "m"."deletedAt" IS NULL
      ${buildTimeRangeFilter(timeRange, '"apu"."timestamp"')}
  `;

  if (initiatedBy === InitiatedBy.User) {
    whereClause = Prisma.sql`${whereClause} AND "apu"."system" = FALSE AND "apu"."agent" = FALSE AND "apu"."knowledgeGraph" = FALSE AND "apu"."embedding" = FALSE`;
  } else if (initiatedBy === InitiatedBy.System) {
    whereClause = Prisma.sql`${whereClause} AND "apu"."system" = TRUE`;
  } else if (initiatedBy === InitiatedBy.Agent) {
    whereClause = Prisma.sql`${whereClause} AND "apu"."agent" = TRUE`;
  } else if (initiatedBy === InitiatedBy.KnowledgeGraph) {
    whereClause = Prisma.sql`${whereClause} AND "apu"."knowledgeGraph" = TRUE`;
  } else if (initiatedBy === InitiatedBy.Embedding) {
    whereClause = Prisma.sql`${whereClause} AND "apu"."embedding" = TRUE`;
  }

  if (aiProvider !== 'all') {
    const aiProviderRecord = await db.aiProvider.findUnique({
      where: { id: aiProvider, deletedAt: null },
    });

    if (!aiProviderRecord) {
      logger.error('AI provider not found');
      throw new Error('AI provider not found');
    }

    aiProviderLabel = aiProviderRecord.label;
    const aiProviderUUID = Prisma.sql`CAST(${aiProvider} AS UUID)`;
    whereClause = Prisma.sql`${whereClause} AND "apu"."aiProviderId" = ${aiProviderUUID}`;
  }

  if (model !== 'all') {
    const modelRecord = await db.model.findUnique({
      where: { id: model, deletedAt: null },
    });

    if (!modelRecord) {
      logger.error('Model not found');
      throw new Error('Model not found');
    }

    modelLabel = modelRecord.name;
    const modelUUID = Prisma.sql`CAST(${model} AS UUID)`;
    whereClause = Prisma.sql`${whereClause} AND "apu"."modelId" = ${modelUUID}`;
  }

  if (userGroupId !== 'all') {
    return getUserLevelUsageRecords(
      whereClause,
      userGroupId,
      userId,
      initiatedBy,
      aiProviderLabel,
      modelLabel,
      timeRange,
    );
  }

  // Aggregate path (no group selected) — existing behavior
  let totalCost: number | null = null;
  let totalInputTokens: number | null = null;
  let totalOutputTokens: number | null = null;
  try {
    const rawRecords = await db.$queryRaw<any[]>`
      WITH filtered_usage_costs AS (
        SELECT
            "apu"."aiProviderId",
            "ap"."label" AS "aiProviderLabel",
            "apu"."modelId",
            "m"."name" AS "modelLabel",
            "apu"."costPerInputToken",
            "apu"."costPerOutputToken",
            "apu"."inputTokensUsed",
            "apu"."outputTokensUsed",
            ("apu"."inputTokensUsed" * "apu"."costPerInputToken") AS "inputCost",
            ("apu"."outputTokensUsed" * "apu"."costPerOutputToken") AS "outputCost"
        FROM
            "AiProviderUsage" apu
        LEFT JOIN
            "AiProvider" ap ON "apu"."aiProviderId" = "ap"."id"
        LEFT JOIN
            "Model" m ON "apu"."modelId" = "m"."id"
        ${whereClause}
      ),

      model_aggregates AS (
        SELECT
            "aiProviderId",
            "aiProviderLabel",
            "modelId",
            "modelLabel",
            AVG("costPerInputToken") AS "costPerInputToken",
            AVG("costPerOutputToken") AS "costPerOutputToken",
            SUM("inputCost" + "outputCost") AS "totalCost",
            SUM("inputTokensUsed") AS "totalInputTokens",
            SUM("outputTokensUsed") AS "totalOutputTokens"
        FROM
            "filtered_usage_costs"
        GROUP BY
            "aiProviderId", "aiProviderLabel", "modelId", "modelLabel"
      ),

      provider_aggregates AS (
        SELECT
            "aiProviderId",
            "aiProviderLabel",
            AVG("costPerInputToken") AS "costPerInputToken",
            AVG("costPerOutputToken") AS "costPerOutputToken",
            SUM("inputCost" + "outputCost") AS "totalCost",
            SUM("inputTokensUsed") AS "totalInputTokens",
            SUM("outputTokensUsed") AS "totalOutputTokens"
        FROM
            "filtered_usage_costs"
        GROUP BY
            "aiProviderId", "aiProviderLabel"
      ),

      total_cost AS (
        SELECT
          SUM("inputCost" + "outputCost") AS "totalCost",
          SUM("inputTokensUsed") AS "totalInputTokens",
          SUM("outputTokensUsed") AS "totalOutputTokens"
        FROM "filtered_usage_costs"
      )

      SELECT
        "pa"."aiProviderId",
        "pa"."aiProviderLabel",
        "pa"."costPerInputToken",
        "pa"."costPerOutputToken",
        "pa"."totalCost" AS "providerTotalCost",
        "pa"."totalInputTokens" AS "providerTotalInputTokens",
        "pa"."totalOutputTokens" AS "providerTotalOutputTokens",
        "ma"."modelId",
        "ma"."modelLabel",
        "ma"."costPerInputToken" AS "modelCostPerInputToken",
        "ma"."costPerOutputToken" AS "modelCostPerOutputToken",
        "ma"."totalCost" AS "modelTotalCost",
        "ma"."totalInputTokens" AS "modelTotalInputTokens",
        "ma"."totalOutputTokens" AS "modelTotalOutputTokens",
        "tc"."totalCost" AS "overallTotalCost",
        "tc"."totalInputTokens" AS "overallTotalInputTokens",
        "tc"."totalOutputTokens" AS "overallTotalOutputTokens"
      FROM
        provider_aggregates pa
      LEFT JOIN
        model_aggregates ma ON "pa"."aiProviderId" = "ma"."aiProviderId",
        total_cost tc;
    `;

    if (rawRecords === null) {
      logger.error('Unexpected null result from database query.');
      throw new Error('Unexpected null result from database query.');
    }

    if (rawRecords.length === 0) {
      logger.info('No usage records found');
    }

    totalCost = rawRecords.length !== 0 ? rawRecords[0].overallTotalCost : 0;
    totalInputTokens = rawRecords.length !== 0 ? rawRecords[0].overallTotalInputTokens : 0;
    totalOutputTokens = rawRecords.length !== 0 ? rawRecords[0].overallTotalOutputTokens : 0;

    if (totalCost === null) {
      logger.error('Unexpected null result from database query.');
      throw new Error('Total cost was unexpectedly null.');
    }

    if (totalInputTokens === null) {
      totalInputTokens = 0;
    }

    if (totalOutputTokens === null) {
      totalOutputTokens = 0;
    }

    const providersMap: { [key: string]: ProviderCosts } = {};

    rawRecords.forEach((record) => {
      if (!providersMap[record.aiProviderId]) {
        providersMap[record.aiProviderId] = {
          id: record.aiProviderId,
          label: record.aiProviderLabel,
          costPerInputToken: record.costPerInputToken,
          costPerOutputToken: record.costPerOutputToken,
          cost: record.providerTotalCost,
          inputTokens: record.providerTotalInputTokens ?? 0,
          outputTokens: record.providerTotalOutputTokens ?? 0,
          models: [],
        };
      }
      if (record.modelId) {
        providersMap[record.aiProviderId].models.push({
          id: record.modelId,
          label: record.modelLabel,
          cost: record.modelTotalCost,
          inputTokens: record.modelTotalInputTokens ?? 0,
          outputTokens: record.modelTotalOutputTokens ?? 0,
          costPerInputToken: record.modelCostPerInputToken,
          costPerOutputToken: record.modelCostPerOutputToken,
        });
      }
    });

    const allProviders = await db.aiProvider.findMany({
      where:
        aiProvider === 'all'
          ? { deletedAt: null }
          : { id: aiProvider, deletedAt: null },
      select: {
        id: true,
        label: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        models: {
          select: { id: true, name: true },
          where:
            model === 'all'
              ? { deletedAt: null }
              : { id: model, deletedAt: null },
        },
      },
    });

    allProviders.forEach((provider) => {
      if (!providersMap[provider.id]) {
        providersMap[provider.id] = {
          id: provider.id,
          label: provider.label,
          costPerInputToken: provider.costPerInputToken,
          costPerOutputToken: provider.costPerOutputToken,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          models: provider.models.map((m) => ({
            id: m.id,
            label: m.name,
            cost: 0,
            inputTokens: 0,
            outputTokens: 0,
          })),
        };
      } else if (model === 'all') {
        provider.models.forEach((m) => {
          if (!providersMap[provider.id].models.some((pm) => pm.id === m.id)) {
            providersMap[provider.id].models.push({
              id: m.id,
              label: m.name,
              cost: 0,
              inputTokens: 0,
              outputTokens: 0,
            });
          }
        });
      }
    });

    return {
      initiatedBy,
      aiProvider: aiProviderLabel,
      model: modelLabel,
      timeRange,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      providers: Object.values(providersMap),
    };
  } catch (error) {
    logger.error('Error fetching usage records', error);
    throw new Error('Error fetching usage records');
  }
}

async function getUserLevelUsageRecords(
  whereClause: Prisma.Sql,
  userGroupId: string,
  userId: string,
  initiatedBy: InitiatedBy,
  aiProviderLabel: string | undefined,
  modelLabel: string | undefined,
  timeRange: TimeRange,
): Promise<UsageRecords> {
  const userGroupUUID = Prisma.sql`CAST(${userGroupId} AS UUID)`;

  let userIdClause = Prisma.sql``;
  if (userId !== 'all') {
    const userUUID = Prisma.sql`CAST(${userId} AS UUID)`;
    userIdClause = Prisma.sql`AND "apu"."userId" = ${userUUID}`;
  }

  const userGroup = await db.userGroup.findUnique({
    where: { id: userGroupId },
    select: { label: true },
  });

  let userNameLabel: string | undefined;
  if (userId !== 'all') {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    userNameLabel = user?.name ?? undefined;
  }

  try {
    const rawRecords = await db.$queryRaw<any[]>`
      WITH filtered_usage_costs AS (
        SELECT
            "apu"."userId",
            "u"."name" AS "userName",
            "apu"."aiProviderId",
            "ap"."label" AS "aiProviderLabel",
            "apu"."costPerInputToken",
            "apu"."costPerOutputToken",
            "apu"."modelId",
            "m"."name" AS "modelLabel",
            "apu"."inputTokensUsed",
            "apu"."outputTokensUsed",
            ("apu"."inputTokensUsed" * "apu"."costPerInputToken" +
             "apu"."outputTokensUsed" * "apu"."costPerOutputToken") AS "cost"
        FROM
            "AiProviderUsage" apu
        INNER JOIN "User" u ON "u"."id" = "apu"."userId"
        LEFT JOIN "AiProvider" ap ON "apu"."aiProviderId" = "ap"."id"
        LEFT JOIN "Model" m ON "apu"."modelId" = "m"."id"
        INNER JOIN "UserGroupMembership" ugm ON "ugm"."userId" = "apu"."userId"
        ${whereClause}
        AND "ugm"."userGroupId" = ${userGroupUUID}
        ${userIdClause}
      ),

      user_provider_model_agg AS (
        SELECT
            "userId", "userName",
            "aiProviderId", "aiProviderLabel",
            "modelId", "modelLabel",
            AVG("costPerInputToken") AS "costPerInputToken",
            AVG("costPerOutputToken") AS "costPerOutputToken",
            SUM("cost") AS "modelCost",
            SUM("inputTokensUsed") AS "modelInputTokens",
            SUM("outputTokensUsed") AS "modelOutputTokens"
        FROM filtered_usage_costs
        GROUP BY "userId", "userName", "aiProviderId", "aiProviderLabel", "modelId", "modelLabel"
      ),

      user_provider_agg AS (
        SELECT
            "userId", "userName",
            "aiProviderId", "aiProviderLabel",
            AVG("costPerInputToken") AS "costPerInputToken",
            AVG("costPerOutputToken") AS "costPerOutputToken",
            SUM("cost") AS "providerCost",
            SUM("inputTokensUsed") AS "providerInputTokens",
            SUM("outputTokensUsed") AS "providerOutputTokens"
        FROM filtered_usage_costs
        GROUP BY "userId", "userName", "aiProviderId", "aiProviderLabel"
      ),

      user_agg AS (
        SELECT
          "userId",
          "userName",
          SUM("cost") AS "userCost",
          SUM("inputTokensUsed") AS "userInputTokens",
          SUM("outputTokensUsed") AS "userOutputTokens"
        FROM filtered_usage_costs
        GROUP BY "userId", "userName"
      ),

      total_cost AS (
        SELECT
          SUM("cost") AS "totalCost",
          SUM("inputTokensUsed") AS "totalInputTokens",
          SUM("outputTokensUsed") AS "totalOutputTokens"
        FROM filtered_usage_costs
      )

      SELECT
        "ua"."userId",
        "ua"."userName",
        "ua"."userCost",
        "ua"."userInputTokens",
        "ua"."userOutputTokens",
        "upa"."aiProviderId",
        "upa"."aiProviderLabel",
        "upa"."costPerInputToken" AS "providerCostPerInputToken",
        "upa"."costPerOutputToken" AS "providerCostPerOutputToken",
        "upa"."providerCost",
        "upa"."providerInputTokens",
        "upa"."providerOutputTokens",
        "upma"."modelId",
        "upma"."modelLabel",
        "upma"."costPerInputToken" AS "modelCostPerInputToken",
        "upma"."costPerOutputToken" AS "modelCostPerOutputToken",
        "upma"."modelCost",
        "upma"."modelInputTokens",
        "upma"."modelOutputTokens",
        "tc"."totalCost" AS "overallTotalCost",
        "tc"."totalInputTokens" AS "overallTotalInputTokens",
        "tc"."totalOutputTokens" AS "overallTotalOutputTokens"
      FROM user_agg ua
      JOIN user_provider_agg upa ON "upa"."userId" = "ua"."userId"
      JOIN user_provider_model_agg upma
        ON "upma"."userId" = "upa"."userId"
        AND "upma"."aiProviderId" = "upa"."aiProviderId"
      CROSS JOIN total_cost tc
      ORDER BY "ua"."userCost" DESC, "upa"."providerCost" DESC, "upma"."modelCost" DESC;
    `;

    const totalCost = rawRecords.length > 0 ? (rawRecords[0].overallTotalCost ?? 0) : 0;
    const totalInputTokens = rawRecords.length > 0 ? (rawRecords[0].overallTotalInputTokens ?? 0) : 0;
    const totalOutputTokens = rawRecords.length > 0 ? (rawRecords[0].overallTotalOutputTokens ?? 0) : 0;

    const usersMap: { [key: string]: UserGroupUsageRecord } = {};

    rawRecords.forEach((record) => {
      if (!usersMap[record.userId]) {
        usersMap[record.userId] = {
          id: record.userId,
          name: record.userName,
          cost: record.userCost,
          inputTokens: record.userInputTokens ?? 0,
          outputTokens: record.userOutputTokens ?? 0,
          providers: [],
        };
      }

      const userRecord = usersMap[record.userId];
      let provider = userRecord.providers.find((p) => p.id === record.aiProviderId);

      if (!provider) {
        provider = {
          id: record.aiProviderId,
          label: record.aiProviderLabel,
          costPerInputToken: record.providerCostPerInputToken,
          costPerOutputToken: record.providerCostPerOutputToken,
          cost: record.providerCost,
          inputTokens: record.providerInputTokens ?? 0,
          outputTokens: record.providerOutputTokens ?? 0,
          models: [],
        };
        userRecord.providers.push(provider);
      }

      if (record.modelId) {
        provider.models.push({
          id: record.modelId,
          label: record.modelLabel,
          cost: record.modelCost,
          inputTokens: record.modelInputTokens ?? 0,
          outputTokens: record.modelOutputTokens ?? 0,
          costPerInputToken: record.modelCostPerInputToken,
          costPerOutputToken: record.modelCostPerOutputToken,
        });
      }
    });

    return {
      initiatedBy,
      aiProvider: aiProviderLabel,
      model: modelLabel,
      timeRange,
      userGroupLabel: userGroup?.label,
      userName: userNameLabel,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      providers: [],
      users: Object.values(usersMap),
    };
  } catch (error) {
    logger.error('Error fetching user-level usage records', error);
    throw new Error('Error fetching usage records');
  }
}
