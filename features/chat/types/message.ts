import { BaseArtifact } from '@/features/shared/types/document';
import type { NodeMappingEntry } from '@/features/graph-database/services/buildNodeMapping';
import type { EdgeMappingEntry } from '@/features/graph-database/services/buildEdgeMapping';
import type { HandleMap } from '@/features/chat/utils/graphCitationHelpers';

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export enum ContextType {
  DOCUMENT_LIBRARY = 'DOCUMENT_LIBRARY',
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE',
  GRAPH_ENTITY = 'GRAPH_ENTITY',
  GRAPH_CONCEPT = 'GRAPH_CONCEPT',
}

export enum QueryScope {
  DOCUMENT = 'document',
  TABLE = 'table',
  GRAPH = 'graph',
  GRAPH_SELECTION = 'graph_selection',
}

export enum DeepResearchStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AsyncChatStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
}

type DocumentLibraryCitation = {
  contextType: ContextType.DOCUMENT_LIBRARY;
  documentId: string;
  embeddingId?: string;
  startPosition?: number;
  endPosition?: number;
}

type KnowledgeBaseCitation = {
  contextType: ContextType.KNOWLEDGE_BASE;
  knowledgeBaseId: string;
}

type GraphEntityCitation = {
  contextType: ContextType.GRAPH_ENTITY;
  graphEntityId: string;
  description?: string;
  aliases?: string[];
}

type GraphConceptCitation = {
  contextType: ContextType.GRAPH_CONCEPT;
  graphConceptId: string;
  description?: string;
  category?: string;
}

export type Citation = {
  citation: string;
  sourceLabel: string;
  summary?: string; // Optional summary for display (used instead of full citation content when available)
} & (KnowledgeBaseCitation | DocumentLibraryCitation | GraphEntityCitation | GraphConceptCitation)

export type GraphSnapshot = {
  id: string;
  chatMessageId: string;
  nodeIds: string[];
  documentIds: string[];
  positions?: Record<string, { x: number; y: number }> | null;
  createdAt: Date;
}

export type Message = {
  id: string,
  chatId: string,
  role: MessageRole,
  content: string,
  createdAt: Date,
  documentIds: string[],
  citations: Citation[],
  artifacts: Artifact[],
  followUps: ChatMessageFollowUp[],
  userChoices: ChatMessageUserChoice[],
  deepResearch: boolean,
  deepResearchJobId?: string | null,
  deepResearchStatus?: DeepResearchStatus | null,
  asyncChatJobId?: string | null,
  asyncChatStatus?: AsyncChatStatus | null,
  progressMessages?: string[] | null,
  graphSearchResult?: GraphSearchResultData[] | null,
  graphSnapshot?: GraphSnapshot | null,
}

export type ChatMessageFollowUp = {
  id: string;
  chatMessageId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatMessageUserChoice = {
  id: string;
  chatMessageId: string;
  label: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Artifact = BaseArtifact & {
  chatMessageId: string;
};

export type GraphSearchResultData = {
  rows: Record<string, unknown>[];
  nodeMapping: NodeMappingEntry[];
  /**
   * Relationship rows mapped to their `(src, relType, tgt)` triples. Present on cypher
   * `uiPayload`s that traverse a relationship; absent on node-only/search results. Drives
   * the write-time `[[R#]]` citation handles — the render keys off `graphData.edges`, not this.
   */
  edgeMapping?: EdgeMappingEntry[];
  query: string;
  rowCount: number;
  generatedCypher: string;
  /**
   * Discriminates the synthesis-time "evidence" subgraph (nodes the answer relies on
   * + induced edges) from the raw per-query "exploration" results. Optional and
   * absent on legacy/persisted rows — absence is treated as 'exploration'.
   */
  kind?: 'evidence' | 'exploration';
  /**
   * Citation → graph cross-highlight (present only on the `kind:'evidence'` entry). `citedText`
   * is the answer text WITH the inline `[[E#]]/[[R#]]/[[Q#]]` markers still in place (the persisted
   * `content` keeps them stripped); `handleMap` resolves each handle to a node UUID / relationship
   * triple / retrieval index. The render turns the markers into interactive anchors that highlight
   * the cited node(s)/edge(s) on the canvas. Absent on legacy rows → answer renders plainly.
   */
  handleMap?: HandleMap;
  citedText?: string;
  graphData?: {
    nodes: {
      id: number;
      label: string;
      labels: string[];
      properties: Record<string, any>;
      group: string;
      isAnchor: boolean;
    }[];
    edges: {
      from: number;
      to: number;
      label: string;
      type: string;
      properties: Record<string, any>;
      isShortestPath: boolean;
    }[];
  };
};

export interface GraphSearchTab {
  id: string;
  label: string;
  data: GraphSearchResultData;
  messageId: string;
}

export type ParsedUserMessage = {
  userMessage: string;
  selectedText: string | null;
}
