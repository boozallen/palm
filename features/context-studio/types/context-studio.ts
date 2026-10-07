import { z } from 'zod';
import { UseCase } from '@/features/shared/types/use-case';

export enum TimeRange {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
  YearToDate = 'ytd',
  Forever = 'forever',
}

export const contextStudioQuerySchema = z.object({
  timeRange: z.nativeEnum(TimeRange),
  userGroupId: z.string().uuid().or(z.literal('all')),
  userId: z.string().uuid().or(z.literal('all')),
  excludeAdmins: z.boolean().default(false),
});

export type ContextStudioQuery = z.infer<typeof contextStudioQuerySchema>;

// The Value drawer's queries take everything the tab is scoped by plus the row
// that was clicked.
export const useCaseQuerySchema = contextStudioQuerySchema.extend({
  useCase: z.nativeEnum(UseCase),
});

// Granular stats types for each category
export type PromptStats = {
  timeRange: TimeRange;
  userGroupLabel?: string;
  userName?: string;
  library: {
    created: number;
    chatted: number;
    bookmarked: number;
    uniqueTags: number;
    byTag: { tag: string; count: number }[];
    tagless: number;
  };
  workflow: {
    created: number;
  };
  generated: number;
  // Every LLM call the app made, from any surface: chat turns, conversation
  // summaries, embeddings, agent workers, workflow prompt primitives and
  // library prompt runs. `LogEntry` carries no promptId or workflowId, so this
  // is NOT attributable to a library prompt or to a workflow — do not render it
  // inside either of those breakdowns.
  llmCalls: number;
  llmCallsBySource: { source: string; method: string; model: string; count: number }[];
};

export type ChatStats = {
  total: number;
  withPrompt: number;
  withAgent: number;
  withUploadedSources: number;
  withKnowledgeBaseSources: number;
};

export type ArtifactStats = {
  total: number;
  chat: number;
  workflow: number;
  byType: { type: string; count: number }[];
  chatArtifacts: {
    total: number;
    byType: { type: string; count: number }[];
    byCreationMethod: {
      modelOnly: {
        total: number;
        byModel: { modelId: string; modelName: string; count: number }[];
      };
      agentProvider: {
        total: number;
        byAgentProvider: { agentProviderId: string; agentProviderName: string; count: number }[];
      };
    };
  };
  workflowArtifacts: {
    total: number;
    byType: { type: string; count: number }[];
  };
};

export type WorkflowStats = {
  total: number;
  shared: number;
  accepted: number;
  rejected: number;
  executions: number;
  successful: number;
  failed: number;
  paused: number;
  cancelled: number;
};

export type DocumentStats = {
  total: number;
  shared: number;
  accepted: number;
  rejected: number;
  embeddings: {
    total: number;
  };
};

export type KnowledgeBaseStats = {
  total: number;
};

export type GraphStats = {
  entities: number;
  concepts: number;
  graphsBuilt: number;
};

export type AiAgentStats = {
  configured: number;
  reportsGenerated: number;
  uniqueUsers: number;
  prismJobs: number;
  prismCompleted: number;
  prismInProgress: number;
  odramJobs: number;
  odramCompleted: number;
  odramInProgress: number;
  marginAnalyses: number;
};

export type AgentProposalJobType = 'PRISM' | 'ODRAM';

export type AgentProposalJob = {
  jobId: string;
  agentType: AgentProposalJobType;
  agentName: string;
  status: string;
  createdAt: string;
  proposalName: string | null;
  clientName: string | null;
  opportunitySummary: string | null;
  financialValue: string | null;
  fallbackFilename: string;
  userName: string;
  userEmail: string | null;
};

export type UserActivityStats = {
  totalUsers: number;
  userGroups: number;
  logins: number;
  totalSessions: number;
  newUsersThisWeek: number;
  newUsersPreviousWeek: number;
  auditLogins: number;
  auditUniqueUsers: number;
  auditLoginsBlocked: number;
  joinCodeUses: number;
  userCreatedCount: number;
  earliestUserCreatedDate: string | null;
  userActivityTimeSeries: {
    date: string;
    logins: number;
    sessions: number;
    newUsers: number;
  }[];
  auditLoginTimeSeries: {
    date: string;
    loginCount: number;
  }[];
  auditLoginBlockedTimeSeries: {
    date: string;
    loginCount: number;
  }[];
  userCreatedTimeSeries: {
    date: string;
    count: number;
  }[];
};

export type AgentServiceStats = {
  totalThreads: number;
  threadsByStatus: { status: string; count: number }[];
  threadsByGraphType: { graphType: string; count: number }[];
  chatsWithAgentProvider: number;
  chatsByAgentProvider: { provider: string; count: number }[];
  toolCallsByType: { toolType: string; count: number }[];
  totalToolCalls: number;
};

// Tool usage inside chat conversations, parsed from ChatMessage.progressMessages
// (the `tool_call` and `subagent_tool_call` progress events) rather than from
// AgentThread.result — a different data source than AgentServiceStats, scoped
// to conversations rather than LangGraph executions.
//
// Broken out by which Agent Service (Settings > Agents & Services > Agent
// Services — currently just the two fixed backends LangGraph and Claude, see
// features/settings/routes/agent-services/get-agent-services.ts) actually ran
// the tool: a top-level `tool_call` runs inside the LangGraph agentic-chat
// graph; a `subagent_tool_call` runs inside the nested Claude Agent SDK
// subagent that `skill_repo_run_command` spawns on the Claude agent service.
export type ConversationToolStats = {
  totalToolCalls: number;
  byAgentService: {
    agentService: string;
    totalToolCalls: number;
    toolCallsByType: { toolName: string; count: number }[];
  }[];
};

// Page transitions — an aggregate from/to matrix over every distinct page in
// the app, ranked by traffic; there is no top-N cutoff or "Other" bucket.
export type PageTransitionStats = {
  // Ordered by traffic desc; drives both rows and columns. Each entry is a
  // normalized route path (e.g. `/settings/ai-agents`), not a human-readable
  // page name — see normalizePath in getPageTransitions.
  pages: string[];
  // matrix[from][to] = transition count. Absent keys mean zero.
  matrix: Record<string, Record<string, number>>;
  totalTransitions: number;
};

// User activity — a single user's audit trail. Consecutive UI_INTERACTION
// records collapse into a run server-side so a heavy week stays cheap to render.
export type UserTrailEntry =
  | {
      kind: 'event';
      id: string;
      event: string;
      label: string;
      description: string;
      outcome: string;
      timestamp: string;
      // Milliseconds of inactivity before this entry; dashes the connector.
      idleBeforeMs: number;
    }
  | {
      kind: 'run';
      id: string;
      count: number;
      // Every step's destination in order, including repeats — the point of
      // expanding a run is to see everywhere it went, not just the unique set.
      hrefs: string[];
      startedAt: string;
      endedAt: string;
    };

export type UserTrailStats = {
  userId: string;
  userName: string | null;
  totalRecords: number;
  meaningfulRecords: number;
  errorRecords: number;
  entries: UserTrailEntry[];
};
