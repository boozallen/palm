import { z } from 'zod';

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

// Session paths — one lane per distinct path, ranked by session volume.
// Sessions are grouped per user on a 30-minute inactivity gap; consecutive
// repeats of the same step collapse so genuinely-identical journeys merge into
// one lane. Lanes beyond the top N fold into a single "Other paths" bucket.
export type SessionPath = {
  id: string;
  // Sessions that took this exact ordered path.
  count: number;
  // Ordered step labels; steps[0] is the entry, the last is the exit.
  steps: string[];
  sampleUser: string;
  // Representative clock window for the sample session, "HH:MM–HH:MM".
  window: string;
  // True for the folded bucket lane, which has no single real path.
  isOther?: boolean;
};

export type SessionPathStats = {
  // Sorted desc by count server-side: top N, then an optional "Other" bucket.
  paths: SessionPath[];
  totalSessions: number;
  totalEvents: number;
  totalNavigations: number;
};

// Activity — per-user session blocks on a shared time axis. Each session is one
// block; block width is its duration, opacity scales with its event count, and
// hovering reveals the session's ordered path.
export type ActivitySession = {
  id: string;
  userId: string;
  userName: string;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  // Ordered page/action labels between the bookends, entry → exit. The sign-in
  // that opened the session and the sign-out that closed it are NOT steps here:
  // they are the flags below, so the client can render them as bookends that a
  // long path can never truncate away.
  path: string[];
  // True when an explicit sign-in opened this session. False for a session that
  // resumed after an inactivity gap with no sign-in recorded.
  startedBySignIn: boolean;
  // True when an explicit sign-out closed this session. False for a session that
  // simply went quiet (tab closed, token expiry).
  endedBySignOut: boolean;
};

export type ActivityUser = {
  id: string;
  name: string;
  // The signed-in viewer, pinned to the top of the swimlane.
  isSelf?: boolean;
};

export type ActivityStats = {
  // Drives the x-axis and its day ticks.
  rangeStart: string;
  rangeEnd: string;
  // Display order: self first, then busiest.
  users: ActivityUser[];
  sessions: ActivitySession[];
  totalSessions: number;
  totalEvents: number;
  userCount: number;
  // How many sessions an explicit sign-in opened / an explicit sign-out closed.
  // The shortfall against totalSessions is the honest signal here: it counts the
  // sessions that resumed or expired without an auth event ever being written.
  signedInSessions: number;
  signedOutSessions: number;
};

// Page transitions — an aggregate from/to matrix over navigation events. Pages
// beyond the top N by total traffic are bucketed into a single "Other" row/col.
export type PageTransitionStats = {
  // Ordered; drives both rows and columns.
  pages: string[];
  // Optional column abbreviations, keyed by page label.
  shortLabels: Record<string, string>;
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
