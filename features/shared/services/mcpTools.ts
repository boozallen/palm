import db from '@/server/db';
import logger from '@/server/logger';
import { AIFactory } from '@/features/ai-provider/factory';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import {
  extractSearchTerms,
  hybridEntitySearch,
  hybridConceptSearch,
  scoreGapFilter,
  filterAnchorsForRelevance,
} from '@/features/graph-database/services/search';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import { cypherSpecialistSearch } from '@/features/graph-database/services/cypherSpecialist';
import { buildNodeMapping } from '@/features/graph-database/services/buildNodeMapping';
import { buildEdgeMapping } from '@/features/graph-database/services/buildEdgeMapping';
import { buildSearchGraphResult } from '@/features/graph-database/services/buildSearchGraphResult';
import {
  ARTIFACT_SEARCH_PAGE_SIZE,
  CONVERSATION_ENTITY_FILTER_LIMIT,
  CONVERSATION_SEARCH_PAGE_SIZE,
  RECENT_CONVERSATIONS_DEFAULT_SINCE_DAYS,
  RECENT_CONVERSATIONS_PAGE_SIZE,
} from '@/features/graph-database/config/conversation-graph.config';
import findArtifacts from '@/features/graph-database/dal/findArtifacts';
import getConversationArtifact from '@/features/graph-database/dal/getConversationArtifact';
import getConversationMessages from '@/features/graph-database/dal/getConversationMessages';
import getConversationsForEntities from '@/features/graph-database/dal/getConversationsForEntities';
import getGraphNodeNames from '@/features/graph-database/dal/getGraphNodeNames';
import resolveGraphNodesByName from '@/features/graph-database/dal/resolveGraphNodesByName';
import getRecentConversations from '@/features/graph-database/dal/getRecentConversations';
import searchChatMessages from '@/features/graph-database/dal/searchChatMessages';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import { Citation, ContextType } from '@/features/chat/types/message';
import { getConfig } from '@/server/config';
import { htmlInstructions } from '@/features/shared/constants/system-prompt';
import { REPO_SERVICE_TOOLS, REPO_SERVICE_HANDLERS } from './repoService/tools';
import { type UsageAttribution } from '@/features/ai-provider/sources/AiProviderUsageTracker';
import { parseUsageAttribution } from '@/features/ai-provider/utils/usageAttribution';

const AGENT_ROW_PAYLOAD_LIMIT = 25_000; // max bytes of serialized rows the agent view carries before we omit them and ask the agent to narrow
const MIN_THRESHOLD = 0.3;
const MATCH_COUNT = 15;
const ENTITY_ANCHOR_LIMIT = 10;
const CONCEPT_ANCHOR_LIMIT = 10;

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
};

export const TOOLS: McpToolDefinition[] = [
  {
    name: 'get_library_documents',
    description: 'Get all documents available in the user\'s library, not just the ones currently in scope for this conversation. Use this as a fallback when search returns no useful results — it lets you suggest documents the user may have forgotten to include. Returns only document IDs and filenames.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_document_list',
    description: 'Get the list of documents available in this conversation, including their IDs, filenames, and whether each document has been indexed into the knowledge graph (isGraphed). Call this first to understand what documents are available. If any document has isGraphed: true, you may use get_schema and cypher_query to query the knowledge graph — call get_schema before cypher_query.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        documentIds: { type: 'string', description: 'JSON array of document IDs to look up' },
      },
      required: ['userId', 'documentIds'],
    },
  },
  {
    name: 'search',
    description: 'Find evidence relevant to the query in the user\'s documents. Returns matching text passages, plus (in graph mode) matching entities and concepts from the knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        query: { type: 'string', description: 'The search query' },
        documentIds: { type: 'string', description: 'JSON array of document IDs in scope' },
        useGraph: { type: 'string', description: 'Pass "true" to include knowledge graph results alongside text chunks' },
        chatMessageId: { type: 'string', description: 'Injected by the caller — the chat message this search belongs to, for cost attribution' },
      },
      required: ['userId', 'query', 'documentIds'],
    },
  },
  {
    name: 'get_schema',
    description: 'Return the knowledge graph schema for these documents: node types, relationship types, properties, and the distinct values of enumerable properties.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        documentIds: { type: 'string', description: 'JSON array of document IDs' },
      },
      required: ['userId', 'documentIds'],
    },
  },
  {
    name: 'cypher_query',
    description: 'Run a structural query against the knowledge graph. Takes a natural-language sub-question and returns the matching rows along with the generated Cypher. The full result set is also rendered for the user as an interactive table and graph, so summarize the findings in prose rather than re-listing every row.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        query: { type: 'string', description: 'Natural-language sub-question to run against the graph' },
        documentIds: { type: 'string', description: 'JSON array of document IDs' },
      },
      required: ['userId', 'query', 'documentIds'],
    },
  },
  {
    name: 'get_text',
    description: 'Return the full plain text of one or more documents in this conversation. Use this when you need complete source material for artifact generation — for example, before regenerating a document with additional detail or when search results are not providing enough coverage. Only call this for documents that are in scope for this conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        documentIds: { type: 'string', description: 'JSON array of document IDs to retrieve text for' },
      },
      required: ['userId', 'documentIds'],
    },
  },
  {
    name: 'get_artifact_instructions',
    description: 'Return the formatting rules for producing artifacts (documents, code, spreadsheets, presentations, videos, and diagrams). Call this before generating any artifact so you know the exact syntax, file extension choices, and quality rules.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_html_instructions',
    description: 'Return detailed instructions for building HTML artifacts: self-contained file rules, presentation aesthetics (Corporate Minimal, Tech Forward, Data-Driven, Magazine Editorial, Executive Brief), CSS templates, and quality checklists. Call this before generating any .html artifact.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_followup_instructions',
    description: 'Return the rules for generating follow-up questions at the end of a response. Call this when your response is educational, open-ended, or invites further exploration.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_app_context',
    description: 'Return background information about PALM (the application the user is currently using) and its features. Call this when the user asks what you can do, how the app works, or about any PALM feature.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'analyze_spreadsheet_data',
    description: 'Run quantitative analysis against a structured data document (Excel or CSV). Use this for numerical questions, calculations, aggregations, or comparisons against spreadsheet data. Do not use for text documents.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        documentId: { type: 'string', description: 'The ID of the Excel or CSV document to analyze' },
        question: { type: 'string', description: 'The quantitative question to answer from the data' },
        modelId: { type: 'string', description: 'The model DB ID to use for code generation' },
        jobId: { type: 'string', description: 'The job ID for streaming progress updates' },
        chatMessageId: { type: 'string', description: 'Injected by the caller — the chat message this analysis belongs to, for cost attribution' },
      },
      required: ['userId', 'documentId', 'question', 'modelId'],
    },
  },
  {
    name: 'search_conversations',
    description: 'Search the user\'s prior conversations (chat history) and return verbatim conversation excerpts, not documents. Excludes the current conversation. Use for questions like "did we discuss X" or "what did we decide about Y". Results are paginated; pass cursor from nextCursor to get more. Optional entityIds/conceptIds (graph node IDs) and entityNames/conceptNames (exact names, resolved server-side to every matching node; aliases also match for entities) additionally surface conversations that cited those graph nodes or any identity-cluster sibling; searchedFor in the response echoes what each id or name resolved to (matchedNodes counts direct name matches — identity-cluster siblings are searched automatically on top of them).',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        query: { type: 'string', description: 'The prior-conversation search query' },
        chatId: { type: 'string', description: 'The current chat ID to exclude' },
        cursor: { type: 'string', description: 'The nextCursor offset from a prior page' },
        entityIds: { type: 'string', description: 'Optional JSON array of graph entity IDs' },
        conceptIds: { type: 'string', description: 'Optional JSON array of graph concept IDs' },
        entityNames: { type: 'string', description: 'Optional JSON array of entity names or aliases' },
        conceptNames: { type: 'string', description: 'Optional JSON array of concept names' },
      },
      required: ['userId', 'query', 'chatId'],
    },
  },
  {
    name: 'get_recent_conversations',
    description: `Get a recent-activity overview of the user's prior conversations (excluding the current one), including each title, first and last activity, referenced entities, document IDs, artifacts, and final message. Use for questions like "what have I been working on" or "where did we leave off". Defaults to the last ${RECENT_CONVERSATIONS_DEFAULT_SINCE_DAYS} days and is paginated via cursor.`,
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        chatId: { type: 'string', description: 'The current chat ID to exclude' },
        sinceDays: { type: 'string', description: 'Optional positive-integer lookback in days' },
        cursor: { type: 'string', description: 'The nextCursor offset from a prior page' },
      },
      required: ['userId', 'chatId'],
    },
  },
  {
    name: 'get_conversation_messages',
    description: 'Fetch messages from one prior conversation by position window. Positions are 0-based; omit both bounds for the whole conversation. Use after search_conversations or get_recent_conversations to pull the surrounding context of a hit.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        chatId: { type: 'string', description: 'The prior conversation ID' },
        startPosition: { type: 'string', description: 'Optional inclusive start position' },
        endPosition: { type: 'string', description: 'Optional inclusive end position' },
      },
      required: ['userId', 'chatId'],
    },
  },
  {
    name: 'find_artifacts',
    description: 'Find artifacts the user created in any prior conversation by title, file type, or creation date. This matches artifact titles only, not artifact contents. Each result includes a short contentPreview of the artifact\'s text (extracted from Word, Excel, and PowerPoint files) for disambiguation and an artifact ID; use get_conversation_artifact for the full content. Results are paginated via cursor.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        label: { type: 'string', description: 'Optional artifact title substring' },
        fileExtension: { type: 'string', description: 'Optional exact file extension, with or without a leading dot' },
        sinceDays: { type: 'string', description: 'Optional positive-integer lookback in days' },
        cursor: { type: 'string', description: 'The nextCursor offset from a prior page' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_conversation_artifact',
    description: 'Fetch one artifact from a prior conversation by id. Artifact ids come from find_artifacts, search_conversations, get_recent_conversations, or get_conversation_messages results. Returns the artifact\'s content with a contentType discriminator (text, extracted-text for Word, Excel, and PowerPoint files, generation-script, docx-source-json, or a binary notice) and paginates via cursor. Only the user\'s own artifacts are accessible.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        artifactId: { type: 'string', description: 'The prior-conversation artifact ID' },
        cursor: { type: 'string', description: 'Optional non-negative character offset from nextCursor' },
      },
      required: ['userId', 'artifactId'],
    },
  },
  ...REPO_SERVICE_TOOLS,
];

export async function callGetLibraryDocuments(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const documents = await db.document.findMany({
    where: {
      OR: [
        { userId },
        { adminCreated: true, accessUsers: { some: { id: userId } } },
      ],
    },
    select: { id: true, filename: true },
    orderBy: { createdAt: 'desc' },
  });
  return documents.map((d) => ({ id: d.id, filename: d.filename }));
}

export async function callGetDocumentList(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const documentIds = JSON.parse(args['documentIds'] ?? '[]') as string[];

  const [documents, graphedResult] = await Promise.all([
    db.document.findMany({
      where: {
        id: { in: documentIds },
        OR: [
          { userId },
          { adminCreated: true, accessUsers: { some: { id: userId } } },
        ],
      },
      select: { id: true, filename: true, createdAt: true, adminCreated: true, dataProfile: true },
    }),
    db.$queryRaw<{ doc_id: string }[]>`
      SELECT DISTINCT doc_id::text
      FROM graph_metadata gm
      CROSS JOIN LATERAL unnest(gm."documentIds") AS doc_id
      WHERE gm."userId" = ${userId}::uuid
      AND gm."status" = 'Completed'
      AND doc_id = ANY(${documentIds}::uuid[])
    `,
  ]);

  const graphedSet = new Set(graphedResult.map((r) => r.doc_id));

  return documents.map((d) => ({
    id: d.id,
    filename: d.filename,
    createdAt: d.createdAt.toISOString(),
    adminCreated: d.adminCreated,
    isGraphed: graphedSet.has(d.id),
    dataProfile: d.dataProfile ?? null,
  }));
}

export async function callSearch(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const query = args['query'] ?? '';
  const documentIds = JSON.parse(args['documentIds'] ?? '[]') as string[];
  const useGraph = args['useGraph'] === 'true';
  const userGroupId = args['userGroupId'] || undefined;
  // Agentic chat reaches retrieval through this tool rather than the chat
  // worker's own embedding path, so the chat message id arrives as a tool
  // argument. Absent when the caller is not a chat turn — the embed stays
  // unattributed rather than inventing provenance. The id is tool input, so it
  // goes through the shared parser: an unvalidated value would reach a uuid
  // column and the usage tracker rethrows when that insert fails.
  const { chatMessageId } = parseUsageAttribution(args);
  const attribution: UsageAttribution | undefined = chatMessageId
    ? { chatMessageId, stepLabel: 'query embedding' }
    : undefined;

  const [embedded, accessibleDocIds] = await Promise.all([
    embedContent(query, userId, undefined, attribution, userGroupId),
    getAccessibleDocumentIds(userId),
  ]);

  if (!embedded.embeddings?.length) {
    return { chunks: [], entities: [], concepts: [] };
  }
  const embeddedQuery = embedded.embeddings[0].embedding;

  if (useGraph) {
    const factory = new AIFactory({ userId, userGroupId });
    const aiSource = await factory.buildKnowledgeGraphSource();
    const extractedTerms = (await extractSearchTerms(query, aiSource.source, aiSource.model)).terms;

    const [entities, concepts, embeddingResult] = await Promise.all([
      hybridEntitySearch({ extractedTerms, embeddedQuery, documentIds, accessibleDocIds, maxResults: ENTITY_ANCHOR_LIMIT }),
      hybridConceptSearch({ extractedTerms, embeddedQuery, documentIds, accessibleDocIds, maxResults: CONCEPT_ANCHOR_LIMIT }),
      getEmbeddingsForDocuments({ userId, embeddedQuery, documentIds, accessibleDocIds, minThreshold: MIN_THRESHOLD, matchCount: MATCH_COUNT }),
    ]);

    const chunkCitations: Citation[] = embeddingResult.map((r) => r.citation);
    const filtered = await filterAnchorsForRelevance(
      query,
      scoreGapFilter(entities),
      scoreGapFilter(concepts),
      aiSource.source,
      aiSource.model,
      chunkCitations,
    );

    const entityAnchors = filtered.entities.map((e) => ({ id: e.id, name: e.entityName, description: e.description, aliases: e.aliases, documentId: e.documentId, score: e.score }));
    const conceptAnchors = filtered.concepts.map((c) => ({ id: c.id, name: c.conceptName, description: c.description, category: c.category, documentId: c.documentId, score: c.score }));

    return {
      chunks: filtered.chunks
        .filter((c) => c.contextType === ContextType.DOCUMENT_LIBRARY)
        .slice(0, MATCH_COUNT)
        .map((c) => {
          const doc = c as Extract<Citation, { contextType: typeof ContextType.DOCUMENT_LIBRARY }>;
          const matched = embeddingResult.find((r) => r.id === doc.embeddingId);
          return { documentId: doc.documentId, embeddingId: doc.embeddingId, sourceLabel: doc.sourceLabel, citation: doc.citation, score: matched?.score ?? 0 };
        }),
      entities: entityAnchors,
      concepts: conceptAnchors,
      uiPayload: buildSearchGraphResult(entityAnchors, conceptAnchors, query),
    };
  }

  const results = await getEmbeddingsForDocuments({ userId, embeddedQuery, documentIds, accessibleDocIds, minThreshold: MIN_THRESHOLD, matchCount: MATCH_COUNT });
  return {
    chunks: results
      .filter((r) => r.citation.contextType === ContextType.DOCUMENT_LIBRARY)
      .map((r) => {
        const c = r.citation as Extract<typeof r.citation, { contextType: typeof ContextType.DOCUMENT_LIBRARY }>;
        return { documentId: c.documentId, embeddingId: c.embeddingId, sourceLabel: c.sourceLabel, citation: c.citation, score: r.score };
      }),
    entities: [],
    concepts: [],
  };
}

export async function callGetSchema(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const documentIds = JSON.parse(args['documentIds'] ?? '[]') as string[];

  const accessibleDocIds = await getAccessibleDocumentIds(userId);
  const schema = await getScopedGraphSchema(accessibleDocIds, documentIds);
  return { schema };
}

function stripNodeIdColumns(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('_nodeId_') || k === '_nodeId' || k === '_nodeIds') { continue; }
      if (k.startsWith('_relType_')) { continue; }
      clean[k] = v;
    }
    return clean;
  });
}

/** Tally rows by a categorical column (type/category/label) so an over-large result
 *  can tell the agent the *shape* of what it would get (e.g. "380 PERSON, 90 ORG")
 *  without sending the rows themselves. Returns undefined when no such column exists. */
function summarizeRowsByCategory(rows: Record<string, unknown>[]): Record<string, number> | undefined {
  const first = rows[0];
  if (!first) { return undefined; }
  const key = ['type', 'category', 'label', 'entityType'].find((k) => k in first);
  if (!key) { return undefined; }
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key] ?? 'unknown');
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export async function callCypherQuery(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const query = args['query'] ?? '';
  const documentIds = JSON.parse(args['documentIds'] ?? '[]') as string[];
  const userGroupId = args['userGroupId'] || undefined;

  const accessibleDocIds = await getAccessibleDocumentIds(userId);
  const result = await cypherSpecialistSearch({ query, userId, userGroupId, documentIds, accessibleDocIds });

  // Build both mappings from the FULL raw results (before stripping internal columns), so the
  // relationships exist even when the agent-visible rows are capped below.
  const nodeMapping = buildNodeMapping(result.results);
  const edgeMapping = buildEdgeMapping(result.results);
  const cleanRows = stripNodeIdColumns(result.results);

  // Keep the agent view small: a single graph result can be 100+ KB of rows, which
  // accumulates across tool calls and can push the inference request past its body
  // limit. When the rows are large, omit them from the agent view (the full set is
  // still rendered to the user via uiPayload) and tell the agent how to narrow — a
  // partial row dump would invite a partial/wrong answer, so we send none.
  const rowsJson = JSON.stringify(cleanRows);
  const rowsTooLarge = rowsJson.length > AGENT_ROW_PAYLOAD_LIMIT;
  const breakdown = rowsTooLarge ? summarizeRowsByCategory(cleanRows) : undefined;

  if (rowsTooLarge) {
    logger.info('[CYPHER-CAP] rows omitted from agent view (over cap) — sent reframe notice', {
      rowCount: result.rowCount,
      rowsBytes: rowsJson.length,
      capBytes: AGENT_ROW_PAYLOAD_LIMIT,
    });
  }

  const agentView: Record<string, unknown> = rowsTooLarge
    ? {
        rowCount: result.rowCount,
        generatedCypher: result.generatedCypher,
        columns: cleanRows[0] ? Object.keys(cleanRows[0]) : [],
        ...(breakdown ? { breakdown } : {}),
        rowsOmitted: true,
        notice:
          `Returned ${result.rowCount} row(s) (~${Math.round(rowsJson.length / 1024)} KB) — too many to include here. ` +
          'The full result set is already shown to the user in the interactive table and graph. ' +
          'If the user asked for a specific or "main"/top/key subset, refine your query (filter, or rank by ' +
          'relationship count + LIMIT) to identify those for your written answer. Otherwise, summarize the ' +
          'findings in prose and refer the user to the table — do not try to re-list every row. ' +
          'If this entire result set is the answer, cite its queryHandle (shown on this result) to use the ' +
          'whole set as evidence rather than listing rows.',
        ...(result.error ? { error: result.error } : {}),
      }
    : {
        rowCount: result.rowCount,
        generatedCypher: result.generatedCypher,
        rows: cleanRows,
        ...(result.error ? { error: result.error } : {}),
      };

  const uiPayload =
    nodeMapping.length > 0
      ? {
          query,
          generatedCypher: result.generatedCypher,
          rowCount: result.rowCount,
          rows: cleanRows,
          nodeMapping,
          edgeMapping,
        }
      : null;

  return { agentView, uiPayload };
}

export function callGetArtifactInstructions(): unknown {
  return { instructions: `## Artifact formatting rules

**CRITICAL: You MUST use the artifact wrapper below. Do NOT use triple-backtick code blocks (\`\`\`html, \`\`\`python, etc.) — those will NOT render as artifacts and will display as raw code to the user.**

Wrap artifact-worthy content with EXACTLY FOUR backticks:
\`\`\`\`artifact("<file_extension>","<label>")
<content>
\`\`\`\`

### When to create an artifact
- Content that is complete, non-trivial, and reusable (typically >250 chars or 15+ lines)
- Do NOT create artifacts for trivial one-liners, demo snippets, or inline tables that fit naturally in prose

### File extension guide
- \`.html\` — web pages, dashboards, interactive tools, email templates. Must be fully self-contained (inline CSS+JS, no CDN). Default for "build an app / make a tool / create a web page" requests. Call \`get_html_instructions\` for the full HTML spec before generating any .html artifact.
- \`.docx\` — formatted documents, reports, essays, letters with rich formatting
- \`.pptx\` — presentations/slide decks written in markdown; # = title slide, ## = subsequent slides
- \`.xlsx\` — tabular data for download; content must be markdown table or CSV format
- \`.mmd\` — Mermaid diagrams (default for generic "create a diagram/graph/flowchart" requests)
- \`.mp4\` — video/animated explainer; content must be a raw JSON array of slide objects
- \`.py\`, \`.js\`, \`.ts\`, etc. — standalone code files only when user explicitly requests that language
- \`.json\`, \`.xml\`, \`.yaml\` — structured data formats
- \`.txt\` — last resort only; prefer any other format first
- \`.md\` — markdown documents

### Rules
- Use EXACTLY FOUR backticks — never three (triple-backtick code fences are forbidden for artifact content)
- The first argument MUST be ONLY the file extension (e.g. \`".html"\`, \`".py"\`, \`".md"\`) — NEVER a filename or path
- The second argument is the human-readable label
- One artifact per cohesive piece of content; never split a web page into separate HTML/CSS/JS artifacts
- Artifact content must appear only inside the artifact wrapper, never repeated in prose
- Always call \`get_html_instructions\` before generating any .html artifact` };
}

export function callGetHtmlInstructions(): unknown {
  return { instructions: htmlInstructions };
}

export function callGetFollowupInstructions(): unknown {
  return { instructions: `## Follow-up question rules

Generate 2–3 follow-up questions when your response is open-ended, educational, or invites
deeper exploration (including simple greetings — they can lead to meaningful conversations).

### Format
Wrap each question individually:
\`<FOLLOWUP>question text here</FOLLOWUP>\`

### Quality guidelines
- Write complete sentences that make sense as clickable prompts
- Encourage deeper engagement — avoid yes/no questions
- Make questions specific to the content just discussed
- Think from the user's perspective: what would they naturally ask next?

### Examples
- After a greeting: \`<FOLLOWUP>Help me create a project</FOLLOWUP>\`
- After a technical explanation: \`<FOLLOWUP>Can you show me a practical example?</FOLLOWUP>\`
- After a recommendation: \`<FOLLOWUP>Which option is best for beginners?</FOLLOWUP>\`` };
}

export function callGetAppContext(): unknown {
  return { instructions: `## About PALM

PALM (Prompt & Agent Library Marketplace) is Booz Allen's enterprise-ready platform that
connects users to large language models and data sources through a unified interface.

### Main features
- **Chat** (current feature): Conversational interface supporting RAG and GraphRAG over
  uploaded documents, artifact generation, and source citations
- **Workflows**: Agentic multi-step task automation with per-step RAG, artifact output, and citations
- **Prompt Library**: Predefined and customizable prompts for common AI use cases
- **Prompt Generator**: Build custom prompts from scratch with instruction fine-tuning
- **Prompt Playground**: Compare responses across multiple LLM providers and models
- **Profile**: Manage your Document Library, Knowledge Base preselections, and User Groups
- **Context Studio**: Observability across chats, documents, agents, and people, plus usage and cost metrics by user, provider, and model
- **Settings** (admin): LLM integrations, feature flags, data source connections, and RBAC` };
}

export async function callAnalyzeData(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const documentId = args['documentId'];
  const question = args['question'];
  const modelId = args['modelId'];
  const jobId = args['jobId'] ?? null;
  const userGroupId = args['userGroupId'] || undefined;
  // An analyze turn runs two agents (pandas, then the write-up), each spanning
  // as many model calls as the analysis takes, so this is the costliest tool a
  // chat turn can reach and the one worst left untraceable. Parsed rather than
  // read straight off args for the reason callSearch documents: the id reaches
  // a uuid column, and the usage tracker rethrows when that insert fails.
  const { chatMessageId } = parseUsageAttribution(args);

  const [document, model] = await Promise.all([
    db.document.findFirst({
      where: {
        id: documentId,
        OR: [
          { userId },
          { adminCreated: true, accessUsers: { some: { id: userId } } },
        ],
      },
      select: { id: true, filename: true, text: true, dataProfile: true },
    }),
    db.model.findUnique({
      where: { id: modelId },
      select: { externalId: true },
    }),
  ]);

  if (!document) {
    return { error: `Document not found or access denied: ${documentId}` };
  }
  if (!document.text) {
    return { error: 'Document has no extracted text' };
  }
  if (!model) {
    return { error: `Model not found: ${modelId}` };
  }

  const { claudeServiceUrl, internalApiKey } = getConfig().agentServices;
  const response = await fetch(`${claudeServiceUrl}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${internalApiKey}`,
    },
    body: JSON.stringify({
      model_id: model.externalId,
      user_id: userId,
      chat_message_id: chatMessageId ?? null,
      user_group_id: userGroupId ?? null,
      question,
      filename: document.filename,
      data_b64: Buffer.from(document.text).toString('base64'),
      data_profile: document.dataProfile ?? null,
      job_id: jobId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[MCP] analyze_spreadsheet_data claude-service error', { status: response.status, error });
    return { error: `Analysis service error: ${response.status}` };
  }

  return response.json();
}

export async function callGetText(args: Record<string, string>): Promise<unknown> {
  const userId = args['userId'];
  const documentIds = JSON.parse(args['documentIds'] ?? '[]') as string[];

  const documents = await db.document.findMany({
    where: {
      id: { in: documentIds },
      OR: [
        { userId },
        { adminCreated: true, accessUsers: { some: { id: userId } } },
      ],
    },
    select: { id: true, filename: true, text: true },
  });

  return documents.map((d) => ({
    id: d.id,
    filename: d.filename,
    text: d.text ?? '',
  }));
}

const parseOptionalNonNegativeInteger = (value?: string): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const parseOptionalPositiveInteger = (value?: string): number | null | undefined => {
  const parsed = parseOptionalNonNegativeInteger(value);
  return parsed === 0 ? null : parsed;
};

const parseStringArray = (value?: string): string[] | null => {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed.filter((item) => item.trim() !== '')
      : null;
  } catch {
    return null;
  }
};

const getToolError = (
  error: unknown,
  allowedMessages: string[],
  fallback: string,
): { error: string } => {
  const message = error instanceof Error ? error.message : '';
  return { error: allowedMessages.includes(message) ? message : fallback };
};

type SearchedForEntry =
  | { id: string; name: string | null; kind: 'entity' | 'concept'; found: true }
  | { id: string; found: false; notice: string }
  | { name: string; kind: 'entity' | 'concept'; matchedNodes: number; found: boolean };

export async function callSearchConversations(args: Record<string, string>): Promise<unknown> {
  if (!(await isMemoryEnabled())) {
    return { error: 'Conversation memory is not enabled' };
  }

  const userId = args['userId']?.trim();
  if (!userId) {
    return { error: 'User ID is required' };
  }
  const cursor = parseOptionalNonNegativeInteger(args['cursor']);
  if (cursor === null) {
    return { error: 'Invalid cursor' };
  }
  const offset = cursor ?? 0;
  const query = args['query'] ?? '';
  const chatId = args['chatId'];
  const entityIds = parseStringArray(args['entityIds']);
  if (entityIds === null) {
    return { error: 'Invalid entityIds' };
  }
  const conceptIds = parseStringArray(args['conceptIds']);
  if (conceptIds === null) {
    return { error: 'Invalid conceptIds' };
  }
  const entityNames = parseStringArray(args['entityNames']);
  if (entityNames === null) {
    return { error: 'Invalid entityNames' };
  }
  const conceptNames = parseStringArray(args['conceptNames']);
  if (conceptNames === null) {
    return { error: 'Invalid conceptNames' };
  }
  const filterCount = entityIds.length + conceptIds.length
    + entityNames.length + conceptNames.length;
  if (filterCount > CONVERSATION_ENTITY_FILTER_LIMIT) {
    logger.warn('Conversation entity filter limit exceeded', {
      userId,
      filterCount,
      limit: CONVERSATION_ENTITY_FILTER_LIMIT,
    });
    return {
      error: `Too many entity filters: ${filterCount} given, limit is ${CONVERSATION_ENTITY_FILTER_LIMIT}`,
    };
  }
  const hasEntityFilters = filterCount > 0;
  if (!query.trim() && !hasEntityFilters) {
    return { results: [], nextCursor: null };
  }

  const searchInput: {
    userId: string;
    embedding?: number[];
    queryText: string;
    excludeChatId: string;
    limit: number;
    offset: number;
  } = {
    userId,
    queryText: query,
    excludeChatId: chatId,
    limit: CONVERSATION_SEARCH_PAGE_SIZE,
    offset,
  };
  if (query.trim()) {
    try {
      const embedded = await embedContent(query, userId);
      if (embedded.embeddings?.[0]?.embedding.length) {
        searchInput.embedding = embedded.embeddings[0].embedding;
      }
    } catch (error) {
      logger.warn('Conversation search embedding failed; using lexical search', {
        userId,
        error,
      });
    }
  }

  try {
    const searchResults = query.trim()
      ? await searchChatMessages(searchInput)
      : [];
    const messageIds = searchResults.map(({ messageId }) => messageId);
    const artifactRows = messageIds.length > 0
      ? await db.chatArtifact.findMany({
          where: { chatMessageId: { in: messageIds } },
          select: {
            id: true,
            chatMessageId: true,
            label: true,
            fileExtension: true,
            createdAt: true,
          },
        })
      : [];
    const artifactsByMessageId = new Map<string, Array<{
      id: string;
      label: string;
      fileExtension: string;
      createdAt: Date;
    }>>();
    artifactRows.forEach(({ id, chatMessageId, label, fileExtension, createdAt }) => {
      const artifacts = artifactsByMessageId.get(chatMessageId) ?? [];
      artifacts.push({ id, label, fileExtension, createdAt });
      artifactsByMessageId.set(chatMessageId, artifacts);
    });

    const results = searchResults.map((result) => ({
      chatId: result.chatId,
      chatTitle: result.chatSummary,
      messageId: result.messageId,
      role: result.role,
      createdAt: result.createdAt,
      text: result.text,
      artifacts: artifactsByMessageId.get(result.messageId) ?? [],
    }));
    const shouldIncludeEntityMatches = hasEntityFilters && offset === 0;
    let entityMatches: Awaited<ReturnType<typeof getConversationsForEntities>> | undefined;
    let searchedFor: SearchedForEntry[] | undefined;
    let entityLookupError: string | undefined;
    // The entity lookup fails on its own: text results are already in hand,
    // so a graph failure degrades the response instead of discarding them.
    if (shouldIncludeEntityMatches) {
      try {
        const accessibleDocumentIds = await getAccessibleDocumentIds(userId);
        const uniqueIds = [...new Set([...entityIds, ...conceptIds])];
        const [idEcho, resolvedEntityNames, resolvedConceptNames] = await Promise.all([
          getGraphNodeNames({ ids: uniqueIds, accessibleDocumentIds }),
          resolveGraphNodesByName({
            names: [...new Set(entityNames)], kind: 'entity', accessibleDocumentIds,
          }),
          resolveGraphNodesByName({
            names: [...new Set(conceptNames)], kind: 'concept', accessibleDocumentIds,
          }),
        ]);
        // Echoes what each requested id/name resolved to, so a wrong id (or a
        // name with no match) is visible to the caller instead of silently
        // returning nothing.
        searchedFor = [
          ...idEcho.map((echo): SearchedForEntry => (echo.found
            ? { id: echo.id, name: echo.name, kind: echo.kind, found: true }
            : { id: echo.id, found: false, notice: 'id not found in your graph' })),
          ...resolvedEntityNames.map(({ name, ids }): SearchedForEntry => ({
            name, kind: 'entity', matchedNodes: ids.length, found: ids.length > 0,
          })),
          ...resolvedConceptNames.map(({ name, ids }): SearchedForEntry => ({
            name, kind: 'concept', matchedNodes: ids.length, found: ids.length > 0,
          })),
        ];
        entityMatches = (await getConversationsForEntities({
          userId,
          ids: [...new Set([
            ...uniqueIds,
            ...resolvedEntityNames.flatMap(({ ids }) => ids),
            ...resolvedConceptNames.flatMap(({ ids }) => ids),
          ])],
          accessibleDocumentIds,
        })).filter((conversation) => conversation.chatId !== chatId);
      } catch (error) {
        entityLookupError = getToolError(
          error,
          [
            'Error finding conversations for entities',
            'Error resolving graph node names',
            'Error resolving graph nodes by name',
            'Error fetching accessible documents',
          ],
          'Error matching conversations by entity',
        ).error;
      }
    }

    return {
      results,
      nextCursor: results.length === CONVERSATION_SEARCH_PAGE_SIZE
        ? String(offset + CONVERSATION_SEARCH_PAGE_SIZE)
        : null,
      ...(searchedFor === undefined ? {} : { searchedFor }),
      ...(entityMatches === undefined ? {} : { entityMatches }),
      ...(entityLookupError === undefined ? {} : { entityLookupError }),
      notice: 'These are verbatim excerpts from the user\'s prior conversations, not documents.',
    };
  } catch (error) {
    return getToolError(
      error,
      ['Error searching chat messages'],
      'Error searching conversations',
    );
  }
}

export async function callGetRecentConversations(
  args: Record<string, string>,
): Promise<unknown> {
  if (!(await isMemoryEnabled())) {
    return { error: 'Conversation memory is not enabled' };
  }

  const userId = args['userId']?.trim();
  if (!userId) {
    return { error: 'User ID is required' };
  }
  const sinceDays = parseOptionalPositiveInteger(args['sinceDays']);
  if (sinceDays === null) {
    return { error: 'Invalid sinceDays' };
  }
  const cursor = parseOptionalNonNegativeInteger(args['cursor']);
  if (cursor === null) {
    return { error: 'Invalid cursor' };
  }
  const offset = cursor ?? 0;

  try {
    const conversations = await getRecentConversations({
      userId,
      sinceDays: sinceDays ?? RECENT_CONVERSATIONS_DEFAULT_SINCE_DAYS,
      limit: RECENT_CONVERSATIONS_PAGE_SIZE,
      offset,
      excludeChatId: args['chatId'],
    });
    return {
      conversations,
      nextCursor: conversations.length === RECENT_CONVERSATIONS_PAGE_SIZE
        ? String(offset + RECENT_CONVERSATIONS_PAGE_SIZE)
        : null,
    };
  } catch (error) {
    return getToolError(
      error,
      ['Error getting recent conversations'],
      'Error getting recent conversations',
    );
  }
}

export async function callGetConversationMessages(
  args: Record<string, string>,
): Promise<unknown> {
  if (!(await isMemoryEnabled())) {
    return { error: 'Conversation memory is not enabled' };
  }

  const userId = args['userId']?.trim();
  if (!userId) {
    return { error: 'User ID is required' };
  }
  const startPosition = parseOptionalNonNegativeInteger(args['startPosition']);
  const endPosition = parseOptionalNonNegativeInteger(args['endPosition']);
  if (startPosition === null || endPosition === null) {
    return { error: 'Invalid position' };
  }

  try {
    return await getConversationMessages({
      userId,
      chatId: args['chatId'],
      ...(startPosition === undefined ? {} : { startPosition }),
      ...(endPosition === undefined ? {} : { endPosition }),
    });
  } catch (error) {
    return getToolError(
      error,
      ['Conversation not found', 'Error getting conversation messages'],
      'Error getting conversation messages',
    );
  }
}

export async function callFindArtifacts(
  args: Record<string, string>,
): Promise<unknown> {
  if (!(await isMemoryEnabled())) {
    return { error: 'Conversation memory is not enabled' };
  }

  const userId = args['userId']?.trim();
  if (!userId) {
    return { error: 'User ID is required' };
  }
  const sinceDays = parseOptionalPositiveInteger(args['sinceDays']);
  if (sinceDays === null) {
    return { error: 'Invalid sinceDays' };
  }
  const cursor = parseOptionalNonNegativeInteger(args['cursor']);
  if (cursor === null) {
    return { error: 'Invalid cursor' };
  }
  const offset = cursor ?? 0;
  const label = args['label']?.trim();
  const fileExtension = args['fileExtension']?.trim();

  try {
    const results = await findArtifacts({
      userId,
      ...(label ? { label } : {}),
      ...(fileExtension ? { fileExtension } : {}),
      ...(sinceDays === undefined ? {} : { sinceDays }),
      cursor: offset,
    });
    return {
      results,
      nextCursor: results.length === ARTIFACT_SEARCH_PAGE_SIZE
        ? String(offset + ARTIFACT_SEARCH_PAGE_SIZE)
        : null,
    };
  } catch (error) {
    return getToolError(
      error,
      ['Error finding artifacts'],
      'Error finding artifacts',
    );
  }
}

export async function callGetConversationArtifact(
  args: Record<string, string>,
): Promise<unknown> {
  if (!(await isMemoryEnabled())) {
    return { error: 'Conversation memory is not enabled' };
  }

  const userId = args['userId']?.trim();
  if (!userId) {
    return { error: 'User ID is required' };
  }
  const artifactId = args['artifactId']?.trim();
  if (!artifactId) {
    return { error: 'Artifact ID is required' };
  }
  const cursor = parseOptionalNonNegativeInteger(args['cursor']);
  if (cursor === null) {
    return { error: 'Invalid cursor' };
  }

  try {
    return await getConversationArtifact({
      userId,
      artifactId,
      ...(cursor === undefined ? {} : { cursor }),
    });
  } catch (error) {
    return getToolError(
      error,
      ['Artifact not found', 'Error fetching conversation artifact'],
      'Error fetching conversation artifact',
    );
  }
}

export const TOOL_HANDLERS: Record<string, (args: Record<string, string>) => Promise<unknown> | unknown> = {
  get_library_documents: callGetLibraryDocuments,
  get_document_list: callGetDocumentList,
  search: callSearch,
  get_schema: callGetSchema,
  cypher_query: callCypherQuery,
  get_text: callGetText,
  get_artifact_instructions: callGetArtifactInstructions,
  get_html_instructions: callGetHtmlInstructions,
  get_followup_instructions: callGetFollowupInstructions,
  get_app_context: callGetAppContext,
  analyze_spreadsheet_data: callAnalyzeData,
  search_conversations: callSearchConversations,
  get_recent_conversations: callGetRecentConversations,
  get_conversation_messages: callGetConversationMessages,
  find_artifacts: callFindArtifacts,
  get_conversation_artifact: callGetConversationArtifact,
  ...REPO_SERVICE_HANDLERS,
};
