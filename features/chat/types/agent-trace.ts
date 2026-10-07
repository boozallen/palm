import { Artifact } from '@/features/chat/types/message';

export enum AgentTraceStepType {
  ToolCall = 'tool_call',
  Thinking = 'thinking',
  Writing = 'writing',
  SubagentToolCall = 'subagent_tool_call',
  SubagentToolResult = 'subagent_tool_result',
  SubagentProgress = 'subagent_progress',
  SubagentComplete = 'subagent_complete',
  Done = 'done',
}

export enum AgentTraceStepStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Error = 'error',
}

// Fallback label shown for a thinking step before the backend streams a real one.
export const DEFAULT_THINKING_LABEL = 'Thinking...';

// Artifact tools are named create_<ext>/edit_<ext> after the file they
// produce. Used to branch rendering (e.g. pluralizing "N artifacts") for
// tool calls that create or edit a file.
export const ARTIFACT_TOOL_NAMES = [
  'create_docx',
  'edit_docx',
  'create_xlsx',
  'edit_xlsx',
  'create_pptx',
  'edit_pptx',
  'edit_artifact',
  'create_html',
  'create_mp4',
] as const;

export type ArtifactToolName = typeof ARTIFACT_TOOL_NAMES[number];

export interface ToolResult {
  title: string;
  subtitle?: string;
  domain?: string;
  faviconUrl?: string;
  url?: string;
  identifier?: string;
  artifact?: Artifact;
}

export interface AgentTraceStep {
  id: string;
  type: AgentTraceStepType;
  status: AgentTraceStepStatus;

  // tool_call
  toolLabel?: string;
  toolName?: string;
  toolArgs?: Record<string, string>;
  resultCount?: number;
  results?: ToolResult[];
  rawOutput?: unknown;
  diffStat?: { added: number; removed: number };
  // collect_citations breakdown (vector search only)
  chunks?: number;
  entities?: number;
  concepts?: number;

  // subagent fields
  subagentStep?: number;
  contentLength?: number;
  isError?: boolean;
  completed?: number;
  total?: number;

  // shared metering (attach to any step that invoked a model or tool)
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;

  children?: AgentTraceStep[];

  // Live timing
  startedAt?: number;
}

export interface AgentTraceRollup {
  totalTokens: number;
  totalDurationMs: number;
  toolCallCount: number;
  completedToolCallCount?: number;
}
