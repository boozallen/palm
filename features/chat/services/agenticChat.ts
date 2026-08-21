import { Agent, fetch as undiciFetch } from 'undici';
import logger from '@/server/logger';
import { getConfig } from '@/server/config';
import { Citation, ContextType, GraphSearchResultData } from '@/features/chat/types/message';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import type { HandleMap } from '@/features/chat/utils/graphCitationHelpers';
import db from '@/server/db';

// undici default headersTimeout is 300s — raise it to match our AbortSignal timeout
// so long-running langgraph jobs don't get cut off before they return response headers.
const _langgraphDispatcher = new Agent({ headersTimeout: 1_860_000 }); // 31 minutes — covers 30 min AbortSignal

/**
 * The structural cypher payload as it arrives from the agent (LangGraph state):
 * a GraphSearchResultData WITHOUT graphData — the heavy nodes/edges are built once
 * at end-of-turn in the worker via fetchEnumerationGraphData.
 */
export type GraphSearchUiPayload = Omit<GraphSearchResultData, 'graphData'>;

interface AgenticChatParams {
  userId: string;
  modelId: string;
  chatId?: string;
  messageId?: string;
  documentIds: string[];
  messages: ChatCompletionMessage[];
  jobId?: string;
  useGraph?: boolean;
  /** Scoped graph schema, injected into the agent's system prompt up front (graph mode only). */
  graphSchema?: string;
  /** When true, the agent cites `[[E#]]`/`[[R#]]` handles inline (write-time evidence grounding). */
  citeEvidence?: boolean;
  /** Maps artifact label → {ext, script} for all editable artifacts (.docx/.xlsx/.pptx) in this chat session. */
  artifactScriptMap?: Record<string, { ext: string; script: string }>;
  /** When true, the agent has access to skill repo tools. */
  hasSkillRepos?: boolean;
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

interface LangGraphResponse {
  status: string;
  state: {
    final_text: string | null;
    citations: AgentServiceCitation[];
    graph_search_results?: GraphSearchUiPayload[];
    handle_map?: HandleMap;
    artifact_script_map?: Record<string, { ext: string; script: string }>;
  };
}

export async function runAgenticChat(params: AgenticChatParams): Promise<AgenticChatResult> {
  const { langgraphServiceUrl, internalApiKey } = getConfig().agentServices;

  logger.info('[AGENTIC-CHAT] Starting agentic chat for %d documents', params.documentIds.length);

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

  logger.info('[AGENTIC-CHAT] analyzable_docs=%d total_docs=%d', analyzableDocs.length, allDocs.length);

  const response = await undiciFetch(`${langgraphServiceUrl}/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${internalApiKey}`,
    },
    dispatcher: _langgraphDispatcher,
    signal: AbortSignal.timeout(1_800_000), // 30 minutes
    body: JSON.stringify({
      graph_type: 'agentic_chat',
      input: {
        user_id: params.userId,
        model_id: params.modelId,
        chat_id: params.chatId ?? '',
        chat_message_id: params.messageId ?? '',
        document_ids: params.documentIds,
        structured_docs: analyzableDocs,
        injected_document_list: allDocs,
        messages: params.messages,
        citations: [],
        final_text: null,
        job_id: params.jobId ?? null,
        graph_search_results: [],
        use_graph: params.useGraph ?? false,
        graph_schema: params.graphSchema ?? '',
        cite_evidence: params.citeEvidence ?? false,
        handle_map: {},
        artifact_script_map: params.artifactScriptMap ?? {},
        has_skill_repos: params.hasSkillRepos ?? false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[AGENTIC-CHAT] Agent service error', { status: response.status, error });
    throw new Error(`Agent service error: ${response.status}`);
  }

  const data = (await response.json()) as LangGraphResponse;
  const rawText = data.state.final_text
    ?? data.state.citations?.map((c) => c.citation).join('\n')
    ?? '';
  // Some models wrap their output in <result>…</result> tags — strip them.
  const finalText = rawText.replace(/^\s*<result>\s*/i, '').replace(/\s*<\/result>\s*$/i, '');

  if (!finalText) {
    logger.warn('[AGENTIC-CHAT] Agent returned no final text');
  }

  return {
    finalText,
    citations: (data.state.citations ?? []).map(mapAgentCitation),
    graphSearchResults: data.state.graph_search_results ?? [],
    handleMap: data.state.handle_map ?? {},
    artifactScriptMap: data.state.artifact_script_map ?? {},
  };
}
