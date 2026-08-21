import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, AgentServiceStats } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import { buildTimeRangeFilter, resolveTimeRangeStart } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';

export default async function getAgentServiceStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
): Promise<AgentServiceStats> {
  try {

    const getUserFilter = (userField: string) => buildUserScopeFilter(userField, userGroupId, userId);

    // The tool-call rollup filters through a Prisma WhereInput, so it needs the
    // window as a Date rather than as the SQL interval the other queries compose.
    const threadsCreatedAfter = resolveTimeRangeStart(timeRange, new Date());

    const [
      totalThreadsResult,
      threadsByStatusResult,
      threadsByGraphTypeResult,
      chatsWithAgentProviderResult,
      chatsByAgentProviderResult,
      agentThreadsWithResults,
    ] = await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "agent_threads" at
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'at."createdAt"')}
          ${getUserFilter('at."userId"')}
      `,
      db.$queryRaw<{ status: string; count: bigint }[]>`
        SELECT at.status, COUNT(*) as count
        FROM "agent_threads" at
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'at."createdAt"')}
          ${getUserFilter('at."userId"')}
        GROUP BY at.status
        ORDER BY count DESC
      `,
      db.$queryRaw<{ graphType: string; count: bigint }[]>`
        SELECT at."graphType", COUNT(*) as count
        FROM "agent_threads" at
        WHERE 1=1
          ${buildTimeRangeFilter(timeRange, 'at."createdAt"')}
          ${getUserFilter('at."userId"')}
        GROUP BY at."graphType"
        ORDER BY count DESC
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Chat" c
        WHERE c."agentProviderId" IS NOT NULL
          ${buildTimeRangeFilter(timeRange, 'c."createdAt"')}
          ${getUserFilter('c."userId"')}
      `,
      db.$queryRaw<{ provider: string; count: bigint }[]>`
        SELECT ap.name as provider, COUNT(*) as count
        FROM "Chat" c
        JOIN "AgentProvider" ap ON c."agentProviderId" = ap.id
        WHERE c."agentProviderId" IS NOT NULL
          ${buildTimeRangeFilter(timeRange, 'c."createdAt"')}
          ${getUserFilter('c."userId"')}
        GROUP BY ap.name
        ORDER BY count DESC
      `,
      db.agentThread.findMany({
        where: {
          result: { not: Prisma.DbNull },
          ...(threadsCreatedAfter && { createdAt: { gte: threadsCreatedAfter } }),
          ...(userId !== 'all' && { userId }),
          ...(userGroupId !== 'all' && {
            user: {
              userGroupMemberhip: {
                some: {
                  userGroupId,
                },
              },
            },
          }),
        },
        select: {
          result: true,
        },
      }),
    ]);

    const totalThreads = Number(totalThreadsResult[0]?.count || 0);
    const threadsByStatus = threadsByStatusResult.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));
    const threadsByGraphType = threadsByGraphTypeResult.map((row) => ({
      graphType: row.graphType,
      count: Number(row.count),
    }));
    const chatsWithAgentProvider = Number(chatsWithAgentProviderResult[0]?.count || 0);
    const chatsByAgentProvider = chatsByAgentProviderResult.map((row) => ({
      provider: row.provider,
      count: Number(row.count),
    }));

    const toolCallCounts: Record<string, number> = {};
    let totalToolCalls = 0;

    for (const thread of agentThreadsWithResults) {
      if (thread.result && typeof thread.result === 'object') {
        const result = thread.result as Record<string, unknown>;

        if (Array.isArray(result.tool_calls)) {
          for (const toolCall of result.tool_calls) {
            if (typeof toolCall === 'object' && toolCall !== null && 'name' in toolCall) {
              const toolName = String(toolCall.name);
              toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1;
              totalToolCalls++;
            }
          }
        }

        if (Array.isArray(result.messages)) {
          for (const message of result.messages) {
            if (
              typeof message === 'object' &&
              message !== null &&
              'tool_calls' in message &&
              Array.isArray(message.tool_calls)
            ) {
              for (const toolCall of message.tool_calls) {
                if (typeof toolCall === 'object' && toolCall !== null) {
                  let toolName = 'unknown';
                  if ('name' in toolCall) {
                    toolName = String(toolCall.name);
                  } else if ('function' in toolCall && typeof toolCall.function === 'object' && toolCall.function !== null && 'name' in toolCall.function) {
                    toolName = String(toolCall.function.name);
                  }
                  toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1;
                  totalToolCalls++;
                }
              }
            }
          }
        }
      }
    }

    const toolCallsByType = Object.entries(toolCallCounts)
      .map(([toolType, count]) => ({ toolType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalThreads,
      threadsByStatus,
      threadsByGraphType,
      chatsWithAgentProvider,
      chatsByAgentProvider,
      toolCallsByType,
      totalToolCalls,
    };
  } catch (error) {
    logger.error('Error fetching agent service stats', { error });
    throw new Error('Failed to fetch agent service statistics');
  }
}
