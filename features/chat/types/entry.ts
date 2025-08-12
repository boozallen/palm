import { Artifact, MessageRole } from '@/features/chat/types/message';

export enum EntryType {
  Message = 'message',
  Document = 'document',
  Skeleton = 'skeleton',
  Retry = 'retry',
}

// Entry is used in the UI to display the various forms of chat entries
export type Entry = {
  id: string;
  chatId: string;
  type: EntryType;
  createdAt: Date;
};

// MessageEntry is used to display messages in the chat
export type MessageEntry = Entry & {
  type: EntryType.Message;
  role: MessageRole;
  content: string;
  citations?: Array<{
    knowledgeBaseId?: string | null;
    documentId?: string | null;
    sourceLabel: string;
    citation: string;
  }>;
  artifacts?: Artifact[];
};

// DocumentEntry is used to display documents in the chat
export type DocumentEntry = Entry & {
  type: EntryType.Document;
  filename: string;
};

// SkeletonEntry is used to display a loading skeleton in the chat
export type SkeletonEntry = Entry & {
  type: EntryType.Skeleton;
  role: MessageRole;
};

// RetryEntry is used to display an error message and retry icon in the chat
export type RetryEntry = Entry & {
  type: EntryType.Retry;
  role: MessageRole;
};

export type Entries = Array<MessageEntry | DocumentEntry | SkeletonEntry | RetryEntry>;
