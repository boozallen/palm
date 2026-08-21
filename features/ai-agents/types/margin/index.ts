export type MarginFlagType =
  | 'NEGATIVE_MARGIN'
  | 'LOW_MARGIN'
  | 'ZERO_REVENUE'
  | 'SIGNIFICANT_DROP'
  | 'SIGNIFICANT_SWING';

export type FlatFileRow = {
  jobKey: string;
  taskOrder: string;
  clin: string;
  taskTitle: string;
  type: string;
  latestActual: Date;
  month: Date;
  revenue: number;
  profit: number;
  aorP: string;
  marginPct: number;
  csvRowNumber: number;
};

export type FlaggedJob = {
  taskOrder: string;
  clin: string;
  taskTitle: string;
  type: string;
  month: string;
  revenue: number;
  plannedMarginPct: number;
  historicalAvgMarginPct: number | null;
  historicalStdDev: number | null;
  dollarImpact: number;
  flags: MarginFlagType[];
  revenueCell: string;
  profitCell: string;
};

export type TmProfitRow = {
  taskOrder: string;
  clin: string;
  taskTitle: string;
  type: string;
  month: string;
  profit: number;
  revenue: number;
  marginPct: number;
};

export type MonthSummary = {
  month: string;
  totalRevenue: number;
  totalDollarImpact: number;
  lowestMarginPct: number;
  flaggedClins: number;
  flagTypes: MarginFlagType[];
};

export type TaskOrderSummary = {
  taskOrder: string;
  taskTitle: string;
  totalClins: number;
  flaggedClins: number;
  totalRevenue: number;
  totalDollarImpact: number;
  totalFutureMonths?: number;
  lastPlannedMonth?: string;
  avgMarginPct: number;
  lowestMarginPct: number;
  flagTypes: MarginFlagType[];
  months?: MonthSummary[];
};

export type MarginAnalysisResult = {
  flaggedJobs: FlaggedJob[];
  taskOrderSummaries: TaskOrderSummary[];
  tmProfitRanking: TmProfitRow[];
  analysisAsOf: string;
  totalJobsAnalyzed: number;
  totalFlaggedJobs: number;
};
