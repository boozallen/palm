import { AgentTraceStep, AgentTraceStepType, AgentTraceStepStatus, ToolResult } from '@/features/chat/types/agent-trace';
import { GraphSearchResultData, Artifact, Citation } from '@/features/chat/types/message';
import { isArtifactToolName } from '@/features/chat/utils/chatHelperFunctions';

interface AgentTraceData {
  progressMessages?: string[];
  graphSearchResults?: GraphSearchResultData[];
  citations?: Citation[];
  citationCount?: number;
  artifactCount?: number;
  artifacts?: Artifact[];
  isProcessing?: boolean;
}

// Structured progress event emitted by the Python backend as JSON.
interface ProgressEvent {
  type: 'tool_call' | 'thinking' | 'writing' | 'collect_citations'
    | 'subagent_tool_call' | 'subagent_tool_result' | 'subagent_thinking'
    | 'subagent_text' | 'subagent_progress' | 'subagent_complete';
  // tool_call
  toolName?: string;
  label?: string;
  args?: Record<string, string>;
  // collect_citations
  chunks?: number;
  entities?: number;
  concepts?: number;
  rowCount?: number;
  graphResult?: boolean;
  items?: { sourceLabel: string; contextType: string; citation?: string }[];
  // subagent_tool_call / subagent_tool_result
  tool?: string;
  step?: number;
  contentLength?: number;
  isError?: boolean;
  length?: number;
  // subagent_progress
  completed?: number;
  total?: number;
  sectionCount?: number;
  // subagent_complete
  durationMs?: number;
  numTurns?: number;
  totalCostUsd?: number;
  usage?: Record<string, unknown>;
}

function tryParseProgressEvent(message: string): ProgressEvent | null {
  if (!message.startsWith('{')) { return null; }
  try {
    const parsed = JSON.parse(message) as ProgressEvent;
    if (typeof parsed.type === 'string') { return parsed; }
    return null;
  } catch {
    return null;
  }
}

function _subagentToolLabel(tool?: string, args?: Record<string, string>): string {
  if (!tool) { return 'Running tool...'; }

  if (tool === 'Read' && args?.file_path) {
    const filename = args.file_path.split('/').pop() || args.file_path;
    return `Reading ${filename}`;
  }
  if (tool === 'Bash' && args?.command) {
    return `$ ${args.command}`;
  }

  return tool;
}

export function buildAgentTraceFromData(data: AgentTraceData): AgentTraceStep[] {
  let stepCounter = 0;

  const { progressMessages = [], graphSearchResults = [], citations = [], citationCount = 0, artifactCount = 0, artifacts = [], isProcessing = false } = data;

  if (progressMessages.length === 0 && graphSearchResults.length === 0 && citationCount === 0 && artifactCount === 0) {
    return [];
  }

  // When there are no progress messages (e.g. after page refresh, Redis expired),
  // reconstruct steps directly from persisted graphSearchResults so the trace is not blank.
  if (progressMessages.length === 0 && graphSearchResults.length > 0) {
    const synthesized: AgentTraceStep[] = graphSearchResults
      .filter((r) => r.kind !== 'evidence')
      .map((r) => {
        const isCypher = !!r.generatedCypher;
        const results: ToolResult[] = r.rows.slice(0, 10).map((row) => ({
          title: extractRowTitle(row),
          subtitle: extractRowSubtitle(row),
        }));
        return {
          id: `tool-graph-${stepCounter++}`,
          type: AgentTraceStepType.ToolCall,
          status: AgentTraceStepStatus.Done,
          toolName: isCypher ? 'cypher_query' : 'search',
          toolLabel: r.query,
          resultCount: r.rowCount,
          results: results.length > 0 ? results : undefined,
        };
      });
    return finalizeFlatSteps(synthesized, citations, citationCount, artifacts, artifactCount, stepCounter);
  }

  // Parse flat list of steps
  const flat: AgentTraceStep[] = [];

  for (let i = 0; i < progressMessages.length; i++) {
    const message = progressMessages[i];
    const isLast = i === progressMessages.length - 1 && isProcessing;

    const event = tryParseProgressEvent(message);

    if (event) {
      // Structured JSON event from new backend
      if (event.type === 'collect_citations') {
        if (event.graphResult && event.rowCount !== undefined) {
          for (let j = flat.length - 1; j >= 0; j--) {
            if (flat[j].type === AgentTraceStepType.ToolCall && (flat[j].toolName === 'search' || flat[j].toolName === 'cypher_query')) {
              if (flat[j].resultCount === undefined) { flat[j].resultCount = event.rowCount; }
              break;
            }
          }
        } else if (!event.graphResult && event.chunks !== undefined) {
          const total = (event.chunks ?? 0) + (event.entities ?? 0) + (event.concepts ?? 0);
          for (let j = flat.length - 1; j >= 0; j--) {
            if (flat[j].type === AgentTraceStepType.ToolCall && (flat[j].toolName === 'search' || flat[j].toolName === 'cypher_query')) {
              if (flat[j].resultCount === undefined) { flat[j].resultCount = total; }
              flat[j].chunks = (flat[j].chunks ?? 0) + (event.chunks ?? 0);
              flat[j].entities = (flat[j].entities ?? 0) + (event.entities ?? 0);
              flat[j].concepts = (flat[j].concepts ?? 0) + (event.concepts ?? 0);
              if (event.items && event.items.length > 0) {
                const newResults: ToolResult[] = event.items.map((item) => ({
                  title: item.sourceLabel || 'Result',
                  subtitle: item.citation || undefined,
                }));
                flat[j].results = [...(flat[j].results || []), ...newResults];
              }
              break;
            }
          }
        }
        stepCounter++;
        continue;
      }

      if (event.type === 'thinking') {
        const prevThinking = flat.length > 0 && flat[flat.length - 1].type === AgentTraceStepType.Thinking
          ? flat[flat.length - 1]
          : null;
        if (prevThinking) {
          prevThinking.toolLabel = event.label || 'Thinking...';
          prevThinking.status = isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done;
        } else {
          flat.push({
            id: `step-${stepCounter++}`,
            type: AgentTraceStepType.Thinking,
            status: isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done,
            toolLabel: event.label || 'Thinking...',
          });
        }
        continue;
      }

      if (event.type === 'writing') {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.Writing,
          status: isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done,
          toolLabel: 'Writing response...',
        });
        continue;
      }

      if (event.type === 'tool_call' && event.toolName) {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.ToolCall,
          status: isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done,
          toolName: event.toolName,
          toolLabel: event.label,
          toolArgs: event.args,
        });
        continue;
      }

      if (event.type === 'subagent_tool_call') {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.SubagentToolCall,
          status: isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done,
          toolName: event.tool,
          toolArgs: event.args,
          toolLabel: _subagentToolLabel(event.tool, event.args),
          subagentStep: event.step,
        });
        continue;
      }

      if (event.type === 'subagent_tool_result') {
        // Backfill the matching subagent_tool_call step with result info
        for (let j = flat.length - 1; j >= 0; j--) {
          if (flat[j].type === AgentTraceStepType.SubagentToolCall && flat[j].subagentStep === event.step) {
            flat[j].status = event.isError ? AgentTraceStepStatus.Error : AgentTraceStepStatus.Done;
            flat[j].contentLength = event.contentLength;
            flat[j].isError = event.isError;
            break;
          }
        }
        stepCounter++;
        continue;
      }

      if (event.type === 'subagent_thinking') {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.Thinking,
          status: AgentTraceStepStatus.Done,
          toolLabel: 'Thinking...',
          contentLength: event.length,
          subagentStep: event.step,
        });
        continue;
      }

      if (event.type === 'subagent_text') {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.Writing,
          status: isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done,
          toolLabel: 'Writing output...',
          contentLength: event.length,
          subagentStep: event.step,
        });
        continue;
      }

      if (event.type === 'subagent_progress') {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.SubagentProgress,
          status: isLast ? AgentTraceStepStatus.Running : AgentTraceStepStatus.Done,
          toolLabel: event.label,
          completed: event.completed,
          total: event.total,
        });
        continue;
      }

      if (event.type === 'subagent_complete') {
        flat.push({
          id: `step-${stepCounter++}`,
          type: AgentTraceStepType.SubagentComplete,
          status: AgentTraceStepStatus.Done,
          toolLabel: event.label,
          durationMs: event.durationMs,
        });
        continue;
      }

      stepCounter++;
      continue;
    }

    // Unrecognized non-JSON message — skip
    stepCounter++;
  }

  // Enhance search steps with real graph result data (row counts + previews)
  if (graphSearchResults.length > 0) {
    let graphResultIndex = 0;
    for (const step of flat) {
      if (step.type === AgentTraceStepType.ToolCall && (step.toolName === 'search' || step.toolName === 'cypher_query') && graphResultIndex < graphSearchResults.length) {
        const result = graphSearchResults[graphResultIndex++];
        step.resultCount = result.rowCount;
        step.toolLabel = result.query || step.toolLabel;
        if (result.rows && result.rows.length > 0) {
          step.results = result.rows.map((row) => ({
            title: extractRowTitle(row),
            subtitle: extractRowSubtitle(row),
          }));
        }
      }
    }
  }

  return finalizeFlatSteps(flat, citations, citationCount, artifacts, artifactCount, stepCounter);
}

function finalizeFlatSteps(
  flat: AgentTraceStep[],
  citations: Citation[],
  citationCount: number,
  artifacts: Artifact[],
  artifactCount: number,
  startCounter: number,
): AgentTraceStep[] {
  let stepCounter = startCounter;

  const seenSourceLabels = new Set<string>();
  const dedupedCitations = citations.filter((c) => {
    if (seenSourceLabels.has(c.sourceLabel)) { return false; }
    seenSourceLabels.add(c.sourceLabel);
    return true;
  });
  const resolvedCitationCount = dedupedCitations.length || citationCount;
  if (resolvedCitationCount > 0) {
    const citationResults: ToolResult[] = dedupedCitations.map((c) => ({
      title: c.sourceLabel,
      subtitle: c.summary,
    }));
    const retrievalStepIndex = flat.findIndex(
      (s) => s.type === AgentTraceStepType.ToolCall && s.toolName === 'get_library_documents'
    );
    if (retrievalStepIndex >= 0) {
      flat[retrievalStepIndex].resultCount = resolvedCitationCount;
      if (citationResults.length > 0) {
        flat[retrievalStepIndex].results = citationResults;
      }
    } else {
      flat.splice(1, 0, {
        id: `tool-retrieve-${stepCounter++}`,
        type: AgentTraceStepType.ToolCall,
        status: AgentTraceStepStatus.Done,
        toolName: 'get_library_documents',
        toolLabel: 'Checking document library...',
        resultCount: resolvedCitationCount,
        results: citationResults.length > 0 ? citationResults : undefined,
      });
    }
  }

  if (artifactCount > 0) {
    const artifactStepIndex = flat.findIndex(
      (s) => s.type === AgentTraceStepType.ToolCall && isArtifactToolName(s.toolName)
    );
    const artifactResults: ToolResult[] = artifacts.map((a) => ({
      title: `${a.label}${a.fileExtension}`,
      subtitle: formatFileSize(a.content?.length || 0),
    }));
    if (artifactStepIndex >= 0) {
      flat[artifactStepIndex].resultCount = artifactCount;
      if (artifactResults.length > 0) {
        flat[artifactStepIndex].results = artifactResults;
      }
    } else {
      flat.push({
        id: `tool-artifact-${stepCounter++}`,
        type: AgentTraceStepType.ToolCall,
        status: AgentTraceStepStatus.Done,
        toolLabel: 'Generated artifacts',
        resultCount: artifactCount,
        results: artifactResults.length > 0 ? artifactResults : undefined,
      });
    }
  }

  return flat;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) { return ''; }
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractRowSubtitle(row: Record<string, unknown>): string | undefined {
  const descFields = ['description', 'Description', 'category', 'Category', 'type', 'Type'];
  for (const field of descFields) {
    const value = row[field];
    if (value && typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function extractRowTitle(row: Record<string, unknown>): string {
  const titleFields = ['Name', 'name', 'Title', 'title', 'Label', 'label', 'Description', 'description'];
  for (const field of titleFields) {
    const value = row[field];
    if (value && typeof value === 'string') {
      return value;
    }
  }
  for (const value of Object.values(row)) {
    if (value && typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return 'Result';
}

export function buildAgentTraceFromProgressMessages(messages: string[]): AgentTraceStep[] {
  return buildAgentTraceFromData({ progressMessages: messages });
}
