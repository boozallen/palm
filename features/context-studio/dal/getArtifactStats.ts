import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, ArtifactStats } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getArtifactStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<ArtifactStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    const getAdminFilter = (userField: string) => {
      if (!excludeAdmins) { return Prisma.empty; }
      return Prisma.sql`AND ${Prisma.raw(userField)} NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`;
    };

    // Get ChatArtifact stats
    const chatArtifactCountResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON ca."chatMessageId" = cm.id
      JOIN "Chat" c ON cm."chatId" = c.id
      WHERE 1=1
        ${buildTimeRangeFilter(timeRange, 'ca."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
    `;
    const chatArtifactCount = Number(chatArtifactCountResult[0]?.count || 0);

    // Get WorkflowArtifact stats
    const workflowArtifactCountResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "workflow_artifacts" wa
      JOIN "WorkflowExecution" we ON wa."workflowExecutionId" = we.id
      WHERE 1=1
        ${buildTimeRangeFilter(timeRange, 'wa."createdAt"')}
        ${getUserFilter('we."triggeredBy"')}
        ${getAdminFilter('we."triggeredBy"')}
    `;
    const workflowArtifactCount = Number(workflowArtifactCountResult[0]?.count || 0);

    const artifactCount = chatArtifactCount + workflowArtifactCount;

    // Get artifacts by type - combining both chat and workflow artifacts
    const chatArtifactsByTypeResult = await db.$queryRaw<{ type: string; count: bigint }[]>`
      SELECT ca."fileExtension" as type, COUNT(*) as count
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON ca."chatMessageId" = cm.id
      JOIN "Chat" c ON cm."chatId" = c.id
      WHERE 1=1
        ${buildTimeRangeFilter(timeRange, 'ca."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
      GROUP BY ca."fileExtension"
    `;

    const workflowArtifactsByTypeResult = await db.$queryRaw<{ type: string; count: bigint }[]>`
      SELECT wa."fileExtension" as type, COUNT(*) as count
      FROM "workflow_artifacts" wa
      JOIN "WorkflowExecution" we ON wa."workflowExecutionId" = we.id
      WHERE 1=1
        ${buildTimeRangeFilter(timeRange, 'wa."createdAt"')}
        ${getUserFilter('we."triggeredBy"')}
        ${getAdminFilter('we."triggeredBy"')}
      GROUP BY wa."fileExtension"
    `;

    // Combine and aggregate artifact types
    const artifactTypeMap = new Map<string, number>();
    chatArtifactsByTypeResult.forEach((row) => {
      artifactTypeMap.set(row.type, Number(row.count));
    });
    workflowArtifactsByTypeResult.forEach((row) => {
      const existing = artifactTypeMap.get(row.type) || 0;
      artifactTypeMap.set(row.type, existing + Number(row.count));
    });

    const artifactsByType = Array.from(artifactTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const chatArtifactsByType = chatArtifactsByTypeResult
      .map((row) => ({ type: row.type, count: Number(row.count) }))
      .sort((a, b) => b.count - a.count);

    const workflowArtifactsByType = workflowArtifactsByTypeResult
      .map((row) => ({ type: row.type, count: Number(row.count) }))
      .sort((a, b) => b.count - a.count);

    // Get chat artifacts for AI Model Only (modelId set, no agentProviderId)
    const modelOnlyTotalResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON ca."chatMessageId" = cm.id
      JOIN "Chat" c ON cm."chatId" = c.id
      WHERE c."modelId" IS NOT NULL
        AND c."agentProviderId" IS NULL
        ${buildTimeRangeFilter(timeRange, 'ca."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
    `;
    const modelOnlyTotal = Number(modelOnlyTotalResult[0]?.count || 0);

    const modelOnlyByModelResult = await db.$queryRaw<{
      modelId: string;
      modelName: string;
      count: bigint
    }[]>`
      SELECT
        c."modelId",
        m.name as "modelName",
        COUNT(*) as count
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON ca."chatMessageId" = cm.id
      JOIN "Chat" c ON cm."chatId" = c.id
      JOIN "Model" m ON c."modelId" = m.id
      WHERE c."modelId" IS NOT NULL
        AND c."agentProviderId" IS NULL
        ${buildTimeRangeFilter(timeRange, 'ca."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
      GROUP BY c."modelId", m.name
    `;

    const modelOnlyByModel = modelOnlyByModelResult
      .map((row) => ({
        modelId: row.modelId,
        modelName: row.modelName,
        count: Number(row.count),
      }))
      .sort((a, b) => b.count - a.count);

    // Get chat artifacts for Agent Provider Only (agentProviderId, no modelId)
    const agentProviderTotalResult = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON ca."chatMessageId" = cm.id
      JOIN "Chat" c ON cm."chatId" = c.id
      WHERE c."agentProviderId" IS NOT NULL AND c."modelId" IS NULL
        ${buildTimeRangeFilter(timeRange, 'ca."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
    `;
    const agentProviderTotal = Number(agentProviderTotalResult[0]?.count || 0);

    const agentProviderByAgentResult = await db.$queryRaw<{
      agentProviderId: string;
      agentProviderName: string;
      count: bigint
    }[]>`
      SELECT
        c."agentProviderId",
        ap.name as "agentProviderName",
        COUNT(*) as count
      FROM "ChatArtifact" ca
      JOIN "ChatMessage" cm ON ca."chatMessageId" = cm.id
      JOIN "Chat" c ON cm."chatId" = c.id
      JOIN "AgentProvider" ap ON c."agentProviderId" = ap.id
      WHERE c."agentProviderId" IS NOT NULL AND c."modelId" IS NULL
        ${buildTimeRangeFilter(timeRange, 'ca."createdAt"')}
        ${getUserFilter('c."userId"')}
        ${getAdminFilter('c."userId"')}
      GROUP BY c."agentProviderId", ap.name
    `;

    const agentProviderByAgent = agentProviderByAgentResult
      .map((row) => ({
        agentProviderId: row.agentProviderId,
        agentProviderName: row.agentProviderName,
        count: Number(row.count),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total: artifactCount,
      chat: chatArtifactCount,
      workflow: workflowArtifactCount,
      byType: artifactsByType,
      chatArtifacts: {
        total: chatArtifactCount,
        byType: chatArtifactsByType,
        byCreationMethod: {
          modelOnly: {
            total: modelOnlyTotal,
            byModel: modelOnlyByModel,
          },
          agentProvider: {
            total: agentProviderTotal,
            byAgentProvider: agentProviderByAgent,
          },
        },
      },
      workflowArtifacts: {
        total: workflowArtifactCount,
        byType: workflowArtifactsByType,
      },
    };
  } catch (error) {
    logger.error('Error fetching artifact stats', { error });
    throw new Error('Failed to fetch artifact statistics');
  }
}
