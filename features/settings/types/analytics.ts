import { z } from 'zod';

export enum TimeRange {
  Day = 'Last 24 hours',
  Week = 'Last 7 days',
  Month = 'Last 30 days',
  Year = 'Last 365 days',
}

export enum InitiatedBy {
  Any = 'Any',
  User = 'User',
  System = 'System',
}

export type ModelCosts = {
  id: string;
  label: string;
  cost: number;
};

export type ProviderCosts = {
  id: string;
  label: string;
  cost: number;
  models: ModelCosts[];
};

export type UsageRecords = {
  aiProvider?: string,
  model?: string,
  initiatedBy: InitiatedBy,
  timeRange: TimeRange,
  totalCost: number,
  providers: ProviderCosts[];
};

export const analyticsQuery = z.object({
  initiatedBy: z.nativeEnum(InitiatedBy),
  aiProvider: z.string().uuid(' ').or(z.literal('all')), // Pass empty error message to not distort UI
  model: z.string().uuid(' ').or(z.literal('all')), // Pass empty error message to not distort UI
  timeRange: z.nativeEnum(TimeRange),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuery>;

export const analyticsInitialValues: AnalyticsQuery = {
  initiatedBy: InitiatedBy.Any,
  aiProvider: 'all',
  model: 'all',
  timeRange: TimeRange.Month,
};
