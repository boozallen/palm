export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export type Message = {
  id: string,
  chatId: string,
  role: MessageRole,
  content: string,
  createdAt: Date,
  citations: {
    knowledgeBaseId: string;
    knowledgeBaseLabel: string;
    citation: string;
  }[],
  artifacts: Artifact[],
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
