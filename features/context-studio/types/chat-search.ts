import { z } from 'zod';

export const chatSearchQuery = z.object({
  search: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  excludeAdmins: z.boolean().default(false),
  timeRange: z.enum(['week', 'month', 'year', 'forever']).optional(),
  userGroupId: z.string().optional(),
  userId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(20),
});

export type ChatSearchQuery = z.infer<typeof chatSearchQuery>;

export const chatSearchInitialValues: ChatSearchQuery = {
  search: undefined,
  startDate: undefined,
  endDate: undefined,
  excludeAdmins: false,
  timeRange: undefined,
  userGroupId: undefined,
  userId: undefined,
  page: 1,
  pageSize: 20,
};

export type UsageStep = {
  stepLabel: string;
  cost: number;
  tokens: number;
};

// One generated artifact plus two views of its spend:
//
// - cost/tokens: the artifact's share of the message that generated it.
// - cumulativeCost/cumulativeTokens: every assistant message's LLM spend in the
//   chat up to and including the generating one, plus the ingestion cost of
//   every document cited anywhere in the chat up to that point (each document
//   charged once, the first time it is cited). Neither term is divided by
//   artifact count — the back-and-forth and retrieval that got the user to a
//   usable output is shared infrastructure, not something to split per output.
//
// All four are null when spend is unknown for that artifact — an agent-provider
// chat, or a message written before usage attribution existed. Null means
// unknown, not free.
export type ArtifactRecord = {
  name: string;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

export type ChatMessage = {
  role: string;
  content: string;
  createdAt: Date;
  usageSteps: UsageStep[];
};

export type DocumentCitation = {
  filename: string;
  citationCount: number;
};

// One click-to-click (or click-to-sign-out) span inside the chat, derived from
// Navigation audit records. A chat left open past SESSION_GAP with no closing
// event has its trailing visit capped there rather than left open-ended.
export type ChatSessionVisit = {
  enteredAt: Date;
  leftAt: Date;
  durationMs: number;
};

// Null when no click-based navigation into the chat was ever recorded (e.g.
// reached only by reload or a direct URL) — unknown, not zero.
export type ChatSessionLength = {
  totalDurationMs: number;
  visits: ChatSessionVisit[];
};

export type ChatSearchResult = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  summary: string | null;
  createdAt: Date;
  documents: DocumentCitation[];
  graphDocuments: DocumentCitation[];
  attachedDocuments: string[];
  artifacts: string[];
  artifactDetails: ArtifactRecord[];
  messages: ChatMessage[];
  graphAnchorCitations: number;
  sessionLength: ChatSessionLength | null;
};

export type ChatSearchQueryResult = {
  records: ChatSearchResult[];
  totalCount: number;
  artifactsGeneratedCount: number;
  citedDocumentsCount: number;
  documentCitationsCount: number;
  graphAnchorCitationsCount: number;
};

export const workflowArtifactSearchQuery = z.object({
  search: z.string().optional(),
  excludeAdmins: z.boolean().default(false),
  timeRange: z.enum(['week', 'month', 'year', 'forever']).optional(),
  userGroupId: z.string().optional(),
  userId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(20),
});

export type WorkflowArtifactSearchQuery = z.infer<typeof workflowArtifactSearchQuery>;

export const workflowArtifactSearchInitialValues: WorkflowArtifactSearchQuery = {
  search: undefined,
  excludeAdmins: false,
  timeRange: undefined,
  userGroupId: undefined,
  userId: undefined,
  page: 1,
  pageSize: 20,
};

// cost/tokens are null when no upstream prompt spend is attributable — see
// getWorkflowArtifactCosts. Null means unknown, not free. cumulativeCost/
// cumulativeTokens are the undivided spend of everything upstream of the
// artifact, the workflow analogue of a chat's spend up to the artifact.
export type WorkflowArtifactSearchResult = {
  id: string;
  name: string;
  workflowName: string | null;
  userName: string | null;
  createdAt: Date;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

export type WorkflowArtifactSearchQueryResult = {
  records: WorkflowArtifactSearchResult[];
  totalCount: number;
};

export const documentSearchQuery = z.object({
  search: z.string().optional(),
  documentType: z.string().optional(),
  // File extension (e.g. '.pdf'), as returned by getFileExtension — distinct
  // from documentType, which is the classification in dataProfile.type.
  fileType: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  excludeAdmins: z.boolean().default(false),
  timeRange: z.enum(['week', 'month', 'year', 'forever']).optional(),
  userGroupId: z.string().optional(),
  userId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(20),
});

export type DocumentSearchQuery = z.infer<typeof documentSearchQuery>;

export const documentSearchInitialValues: DocumentSearchQuery = {
  search: undefined,
  documentType: undefined,
  fileType: undefined,
  startDate: undefined,
  endDate: undefined,
  excludeAdmins: false,
  timeRange: undefined,
  userGroupId: undefined,
  userId: undefined,
  page: 1,
  pageSize: 20,
};

export type DocumentSearchResult = {
  id: string;
  filename: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: Date;
  type: string | null;
  summary: string | null;
};

export type DocumentSearchQueryResult = {
  records: DocumentSearchResult[];
  totalCount: number;
  // File-extension breakdown across the whole matching set (ignoring fileType
  // itself), for the type-filter dropdown's option counts.
  typeCounts: Record<string, number>;
};
