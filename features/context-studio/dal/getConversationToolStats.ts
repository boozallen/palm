import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';
import { TimeRange, ConversationToolStats } from '@/features/context-studio/types/context-studio';
import { resolveTimeRangeStart } from '@/features/context-studio/dal/timeRangeFilter';

// Progress events are stored as JSON-encoded strings inside ChatMessage.progressMessages
// (see features/chat/utils/buildAgentTrace.ts). Only the two event shapes that name a
// tool are relevant here; every other event type is ignored.
interface ToolProgressEvent {
  type?: string;
  // tool_call
  toolName?: string;
  // subagent_tool_call
  tool?: string;
}

// The two Agent Services configured in Settings > Agents & Services > Agent
// Services (features/settings/routes/agent-services/get-agent-services.ts) —
// hardcoded there too, since there is no AgentService table, just these two
// fixed backends. Every tool-firing progress event maps 1:1 to whichever
// service ran it: a top-level `tool_call` runs inside the LangGraph
// agentic-chat graph; a `subagent_tool_call` runs inside the nested Claude
// Agent SDK subagent that the `skill_repo_run_command` tool spawns on the
// Claude agent service (docker/claude-service/endpoints/run_skill_command.py).
const AGENT_SERVICE_LANGGRAPH = 'LangGraph';
const AGENT_SERVICE_CLAUDE = 'Claude';

export default async function getConversationToolStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<ConversationToolStats> {
  try {
    const messagesCreatedAfter = resolveTimeRangeStart(timeRange, new Date());

    const messages = await db.chatMessage.findMany({
      where: {
        progressMessages: { not: Prisma.DbNull },
        ...(messagesCreatedAfter && { createdAt: { gte: messagesCreatedAfter } }),
        chat: {
          ...(userId !== 'all' && { userId }),
          ...((userGroupId !== 'all' || excludeAdmins) && {
            user: {
              ...(userGroupId !== 'all' && {
                userGroupMemberhip: { some: { userGroupId } },
              }),
              ...(excludeAdmins && { role: { not: 'Admin' } }),
            },
          }),
        },
      },
      select: {
        progressMessages: true,
      },
    });

    const langGraphToolCallCounts: Record<string, number> = {};
    const claudeToolCallCounts: Record<string, number> = {};
    let totalLangGraphToolCalls = 0;
    let totalClaudeToolCalls = 0;

    for (const message of messages) {
      if (!Array.isArray(message.progressMessages)) { continue; }

      for (const raw of message.progressMessages) {
        if (typeof raw !== 'string' || !raw.startsWith('{')) { continue; }

        let event: ToolProgressEvent;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        if (event.type === 'tool_call' && event.toolName) {
          langGraphToolCallCounts[event.toolName] = (langGraphToolCallCounts[event.toolName] || 0) + 1;
          totalLangGraphToolCalls++;
        } else if (event.type === 'subagent_tool_call' && event.tool) {
          claudeToolCallCounts[event.tool] = (claudeToolCallCounts[event.tool] || 0) + 1;
          totalClaudeToolCalls++;
        }
      }
    }

    const byCountDesc = (a: { count: number }, b: { count: number }) => b.count - a.count;

    const langGraphToolCallsByType = Object.entries(langGraphToolCallCounts)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort(byCountDesc);
    const claudeToolCallsByType = Object.entries(claudeToolCallCounts)
      .map(([toolName, count]) => ({ toolName, count }))
      .sort(byCountDesc);

    return {
      totalToolCalls: totalLangGraphToolCalls + totalClaudeToolCalls,
      byAgentService: [
        {
          agentService: AGENT_SERVICE_LANGGRAPH,
          totalToolCalls: totalLangGraphToolCalls,
          toolCallsByType: langGraphToolCallsByType,
        },
        {
          agentService: AGENT_SERVICE_CLAUDE,
          totalToolCalls: totalClaudeToolCalls,
          toolCallsByType: claudeToolCallsByType,
        },
      ],
    };
  } catch (error) {
    logger.error('Error fetching conversation tool stats', { error });
    throw new Error('Failed to fetch conversation tool statistics');
  }
}
