export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export enum ContextType {
  DOCUMENT_LIBRARY = 'DOCUMENT_LIBRARY',
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE',
}

type DocumentLibraryCitation = {
  contextType: ContextType.DOCUMENT_LIBRARY;
  documentId: string;
}

type KnowledgeBaseCitation = {
  contextType: ContextType.KNOWLEDGE_BASE;
  knowledgeBaseId: string;
}

export type Citation = {
  citation: string;
  sourceLabel: string;
} & (KnowledgeBaseCitation | DocumentLibraryCitation)

export type Message = {
  id: string,
  chatId: string,
  role: MessageRole,
  content: string,
  createdAt: Date,
  citations: Citation[],
  artifacts: Artifact[],
  followUps: ChatMessageFollowUp[],
}

export type ChatMessageFollowUp = {
  id: string;
  chatMessageId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Artifact = {
  id: string,
  fileExtension: string,
  label: string,
  content: string,
  chatMessageId: string,
  createdAt: Date,
}

export const PREVIEWABLE_FILE_EXTENSIONS = [
  '.md',
  '.mmd',
  '.mermaid',
];

export type ParsedUserMessage = {
  userMessage: string;
  selectedText: string | null;
}
