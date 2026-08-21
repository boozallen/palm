import { z } from 'zod';
import { TimeRange } from '@/features/context-studio/types/context-studio';

export enum InitiatedBy {
  Any = 'Any',
  User = 'User',
  System = 'System',
  Agent = 'Agent',
  KnowledgeGraph = 'Knowledge Graph',
  Embedding = 'Embedding',
}

export type ModelCosts = {
  id: string;
  label: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
};

export type ProviderCosts = {
  id: string;
  label: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  models: ModelCosts[];
};

export type UserGroupUsageRecord = {
  id: string;
  name: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  providers: ProviderCosts[];
};

export type UsageRecords = {
  aiProvider?: string;
  model?: string;
  initiatedBy: InitiatedBy;
  timeRange: TimeRange;
  userGroupLabel?: string;
  userName?: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  providers: ProviderCosts[];
  users?: UserGroupUsageRecord[];
};

// Only the filters the Cost tab owns. Time range, user group, and user come from
// the studio's shared filter bar, which scopes every tab, so the section takes
// them as props rather than carrying a second copy of each control.
export const costQuery = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().uuid(' ').or(z.literal('all')), // Pass empty error message to not distort UI
  model: z.string().uuid(' ').or(z.literal('all')), // Pass empty error message to not distort UI
});

export type CostQuery = z.infer<typeof costQuery>;

export const costInitialValues: CostQuery = {
  initiatedBy: InitiatedBy.Any,
  aiProvider: 'all',
  model: 'all',
};
