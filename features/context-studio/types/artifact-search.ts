import { z } from 'zod';

export const artifactSearchQuery = z.object({
  search: z.string().optional(),
  source: z.enum(['chat', 'workflow']).optional(),
  // Exact match against the artifact's own fileExtension column (e.g. '.pdf').
  fileType: z.string().optional(),
  excludeAdmins: z.boolean().default(false),
  timeRange: z.enum(['week', 'month', 'year', 'forever']).optional(),
  userGroupId: z.string().optional(),
  userId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(20),
});

export type ArtifactSearchQuery = z.infer<typeof artifactSearchQuery>;

export const artifactSearchInitialValues: ArtifactSearchQuery = {
  search: undefined,
  source: undefined,
  fileType: undefined,
  excludeAdmins: false,
  timeRange: undefined,
  userGroupId: undefined,
  userId: undefined,
  page: 1,
  pageSize: 20,
};

// cost/tokens are the artifact's own share of the step that produced it;
// cumulativeCost/cumulativeTokens are the undivided spend of everything
// upstream of it. Null means unknown, not free — see ArtifactRecord/
// WorkflowArtifactCost, whose semantics this mirrors across both sources.
export type ArtifactSearchResult = {
  id: string;
  name: string;
  source: 'chat' | 'workflow';
  userName: string | null;
  workflowName: string | null;
  createdAt: Date;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
  sizeBytes: number | null;
};

export type ArtifactSearchQueryResult = {
  records: ArtifactSearchResult[];
  totalCount: number;
  // File-extension breakdown across both sources under the shared filters
  // (time range / user / excludeAdmins) only — not search, source, or fileType.
  typeCounts: Record<string, number>;
};
