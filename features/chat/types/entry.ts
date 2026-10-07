import { z } from 'zod';

import { Artifact, MessageRole, ChatMessageFollowUp, ChatMessageUserChoice, DeepResearchStatus, AsyncChatStatus, Citation, GraphSearchResultData, MessageFeedback } from '@/features/chat/types/message';
import type { HandleMap } from '@/features/chat/utils/graphCitationHelpers';

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
  citations?: Citation[];
  // True when this answer has a kind:'evidence' graph result (drives the "View graph" link).
  hasEvidenceGraph?: boolean;
  // Citation → graph cross-highlight payload, present only when the evidence entry carries the marked
  // answer text + handle map. Drives the interactive citation render (anchors that highlight the
  // cited graph element on hover/pin). Absent → the answer renders as plain markdown.
  graphCitation?: { citedText: string; handleMap: HandleMap };
  graphSnapshotId?: string | null;
  graphSnapshotNodeCount?: number;
  artifacts?: Artifact[];
  followUps?: ChatMessageFollowUp[];
  userChoices?: ChatMessageUserChoice[];
  deepResearch: boolean;
  deepResearchJobId?: string | null;
  deepResearchStatus?: DeepResearchStatus | null;
  asyncChatJobId?: string | null;
  asyncChatStatus?: AsyncChatStatus | null;
  progressMessages?: string[] | null;
  graphSearchResult?: GraphSearchResultData[];
  feedback?: MessageFeedback | null;
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

export const editEntryForm = z.object({
  message: z.string().trim().min(1, 'An entry is required'),
});

export type EditEntryForm = z.infer<typeof editEntryForm>;
