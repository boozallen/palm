import { Agent, fetch as undiciFetch } from 'undici';
import logger from '@/server/logger';
import { getConfig } from '@/server/config';
import { Citation, ContextType, GraphSearchResultData } from '@/features/chat/types/message';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import type { HandleMap } from '@/features/chat/utils/graphCitationHelpers';
import db from '@/server/db';

// undici defaults: headersTimeout 300s, bodyTimeout 300s.  Raise both to cover
// the 30-min AbortSignal ceiling — long tool executions (analyze_spreadsheet_data,
// create_html) can idle the SSE stream for several minutes between events.
const _langgraphDispatcher = new Agent({ headersTimeout: 1_860_000, bodyTimeout: 1_860_000 });

/**
 * The structural cypher payload as it arrives from the agent (LangGraph state):
 * a GraphSearchResultData WITHOUT graphData — the heavy nodes/edges are built once
 * at end-of-turn in the worker via fetchEnumerationGraphData.
 */
export type GraphSearchUiPayload = Omit<GraphSearchResultData, 'graphData'>;

interface AgenticChatParams {
  userId: string;
  modelId: string;
  fastModelId?: string;
  fastModelName?: string;
  chatId?: string;
  messageId?: string;
  /** Group this chat's usage should be attributed to. Threaded into every AiProviderUsage row the agent generates. */
  userGroupId?: string;
  documentIds: string[];
  messages: ChatCompletionMessage[];
  jobId?: string;
  useGraph?: boolean;
  /** When true, the conversation-memory tools are offered to the agent and the memory signpost is added to its system prompt. */
  memoryEnabled?: boolean;
  /** Scoped graph schema, injected into the agent's system prompt up front (graph mode only). */
  graphSchema?: string;
  /** When true, the agent cites `[[E#]]`/`[[R#]]` handles inline (write-time evidence grounding). */
  citeEvidence?: boolean;
  /** Maps artifact label → {ext, script} for all editable artifacts (.docx/.xlsx/.pptx) in this chat session. */
  artifactScriptMap?: Record<string, { ext: string; script: string }>;
  /** Maps artifact label → extension for inline artifacts (.html/.md/.py/.txt/.json/.mmd/etc.) with no dedicated create/edit tool, editable via edit_artifact. */
  inlineArtifactLabels?: Record<string, string>;
  /** When true, the agent has access to skill repo tools. */
  hasSkillRepos?: boolean;
  /** Abort signal — abort to cancel the LangGraph job and disconnect the stream. */
  abortSignal?: AbortSignal;
  /** Called with each text token delta as it streams in. Used for progressive DB flushes. */
  onChunk?: (delta: string) => Promise<void>;
}

interface AgenticChatResult {
  finalText: string;
  citations: Citation[];
  graphSearchResults: GraphSearchUiPayload[];
  /** Maps each citation handle the agent emitted to a node UUID (`E#`) or relationship triple (`R#`). */
  handleMap: HandleMap;
  /** Maps artifact label → {ext, script} for all editable artifacts generated this turn, for DB persistence. */
  artifactScriptMap: Record<string, { ext: string; script: string }>;
}

interface AgentServiceCitation {
  contextType?: string;
  documentId?: string;
  embeddingId?: string;
  graphEntityId?: string;
  graphConceptId?: string;
  description?: string;
  aliases?: string[];
  category?: string;
  sourceLabel: string;
  citation: string;
  score?: number;
}

function mapAgentCitation(c: AgentServiceCitation): Citation {
  const base = { citation: c.citation, sourceLabel: c.sourceLabel };
  switch (c.contextType) {
    case ContextType.GRAPH_ENTITY:
      return {
        ...base,
        contextType: ContextType.GRAPH_ENTITY,
        graphEntityId: c.graphEntityId ?? '',
        description: c.description,
        aliases: c.aliases,
      };
    case ContextType.GRAPH_CONCEPT:
      return {
        ...base,
        contextType: ContextType.GRAPH_CONCEPT,
        graphConceptId: c.graphConceptId ?? '',
        description: c.description,
        category: c.category,
      };
    default:
      return {
        ...base,
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: c.documentId ?? '',
        embeddingId: c.embeddingId,
      };
  }
}

interface LangGraphStreamState {
  final_text: string | null;
  citations: AgentServiceCitation[];
  graph_search_results?: GraphSearchUiPayload[];
  handle_map?: HandleMap;
  artifact_script_map?: Record<string, { ext: string; script: string }>;
}

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ type: string; data: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        if (!frame.trim()) { continue; }
        const lines = frame.split('\n');
        const eventLine = lines.find(l => l.startsWith('event:'));
        const dataLine = lines.find(l => l.startsWith('data:'));
        if (!dataLine) { continue; }
        const rawData = dataLine.slice(5).trim();
        if (!rawData || rawData === '[DONE]') { continue; }
        try {
          yield {
            type: eventLine?.slice(6).trim() ?? 'message',
            data: JSON.parse(rawData) as unknown,
          };
        } catch {
          logger.warn('[AGENTIC-CHAT] Malformed SSE frame skipped: %s', rawData.slice(0, 100));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function runAgenticChat(params: AgenticChatParams): Promise<AgenticChatResult> {
  const { langgraphServiceUrl, internalApiKey } = getConfig().agentServices;

  logger.debug('[AGENTIC-CHAT] Starting agentic chat for %d documents', params.documentIds.length);

  const ANALYZABLE_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

  const [analyzableDocs, allDocs] = params.documentIds.length > 0
    ? await Promise.all([
        db.document.findMany({
          where: {
            id: { in: params.documentIds },
            OR: ANALYZABLE_EXTENSIONS.map((ext) => ({ filename: { endsWith: ext, mode: 'insensitive' as const } })),
          },
          select: { id: true, filename: true, dataProfile: true },
        }),
        db.document.findMany({
          where: { id: { in: params.documentIds } },
          select: { id: true, filename: true },
        }),
      ])
    : [[], []];

  logger.debug('[AGENTIC-CHAT] analyzable_docs=%d total_docs=%d', analyzableDocs.length, allDocs.length);

  const response = await undiciFetch(`${langgraphServiceUrl}/threads/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${internalApiKey}`,
      'Accept': 'text/event-stream',
    },
    dispatcher: _langgraphDispatcher,
    signal: params.abortSignal
      ? AbortSignal.any([params.abortSignal, AbortSignal.timeout(1_800_000)])
      : AbortSignal.timeout(1_800_000), // always enforce 30-min ceiling
    body: JSON.stringify({
      graph_type: 'agentic_chat',
      input: {
        user_id: params.userId,
        model_id: params.modelId,
        fast_model_id: params.fastModelId ?? '',
        fast_model_name: params.fastModelName ?? '',
        chat_id: params.chatId ?? '',
        chat_message_id: params.messageId ?? '',
        user_group_id: params.userGroupId ?? '',
        document_ids: params.documentIds,
        structured_docs: analyzableDocs,
        injected_document_list: allDocs,
        messages: params.messages,
        citations: [],
        final_text: null,
        job_id: params.jobId ?? null,
        graph_search_results: [],
        use_graph: params.useGraph ?? false,
        memory_enabled: params.memoryEnabled ?? false,
        graph_schema: params.graphSchema ?? '',
        cite_evidence: params.citeEvidence ?? false,
        handle_map: {},
        artifact_script_map: params.artifactScriptMap ?? {},
        inline_artifact_labels: params.inlineArtifactLabels ?? {},
        has_skill_repos: params.hasSkillRepos ?? false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[AGENTIC-CHAT] Agent service error', { status: response.status, error });
    throw new Error(`Agent service error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('[AGENTIC-CHAT] Agent service returned no response body');
  }

  let finalState: LangGraphStreamState | null = null;

  let deltaCount = 0;
  for await (const event of parseSSEStream(response.body as ReadableStream<Uint8Array>)) {
    if (event.type === 'content-block-delta') {
      const delta = (event.data as { delta?: { text?: string } })?.delta?.text ?? '';
      if (delta) {
        deltaCount++;
        if (deltaCount === 1) { logger.debug('[AGENTIC-CHAT] First content-block-delta received'); }
        await params.onChunk?.(delta);
      }
    } else if (event.type === 'values') {
      logger.debug('[AGENTIC-CHAT] values event received after %d deltas', deltaCount);
      finalState = (event.data as { state?: LangGraphStreamState })?.state ?? null;
    } else if (event.type === 'error') {
      const message = (event.data as { message?: string })?.message ?? 'Unknown stream error';
      logger.error('[AGENTIC-CHAT] Stream error event: %s', message);
      throw new Error(`Agent service stream error: ${message}`);
    }
  }

  // If the abort signal fired AND we never got a values event, treat as cancelled.
  // If finalState is populated the agent finished just before the abort — keep the result.
  if (params.abortSignal?.aborted && !finalState) {
    const err = new Error('Request was aborted');
    err.name = 'AbortError';
    throw err;
  }

  if (!finalState) {
    throw new Error('[AGENTIC-CHAT] Stream ended without a values event');
  }

  const rawText = finalState.final_text
    ?? finalState.citations?.map((c) => c.citation).join('\n')
    ?? '';
  // Some models wrap their output in <result>…</result> tags — strip them.
  const finalText = rawText.replace(/^\s*<result>\s*/i, '').replace(/\s*<\/result>\s*$/i, '');

  if (!finalText) {
    logger.warn('[AGENTIC-CHAT] Agent returned no final text');
  }

  return {
    finalText,
    citations: (finalState.citations ?? []).map(mapAgentCitation),
    graphSearchResults: finalState.graph_search_results ?? [],
    handleMap: finalState.handle_map ?? {},
    artifactScriptMap: finalState.artifact_script_map ?? {},
  };
}
