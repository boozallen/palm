import { z } from 'zod';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export const userSearchQuery = z.object({
  search: z.string().optional(),
  membershipStatus: z.enum(['all', 'members', 'nonMembers']).default('all'),
  excludeAdmins: z.boolean().default(false),
  // Derived from the TimeRange enum rather than a hand-written literal union. The
  // hardcoded copy this replaced had already drifted: it silently rejected any
  // preset added to the enum, before the value ever reached the DAL.
  timeRange: z.nativeEnum(TimeRange).optional(),
  userGroupId: z.string().optional(),
  userId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(20),
});

export type UserSearchQuery = z.infer<typeof userSearchQuery>;

export const userSearchInitialValues: UserSearchQuery = {
  search: undefined,
  membershipStatus: 'all',
  excludeAdmins: false,
  timeRange: undefined,
  userGroupId: undefined,
  userId: undefined,
  page: 1,
  pageSize: 20,
};

export type UserSearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  lastLoginAt: Date | null;
  groupCount: number;
  spend: number;
  tokens: number;
};

export type UserSearchQueryResult = {
  records: UserSearchResult[];
  totalCount: number;
  groupMemberCount: number;
  totalSpend: number;
  totalTokens: number;
};
