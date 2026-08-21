/**
 * Utility: Analyze Margins
 *
 * Pure-computation analysis of FF Financials data. Builds historical baselines
 * per job, flags future months that breach thresholds, and produces a T&M
 * profit ranking.
 *
 * Used by: features/ai-agents/routes/margin/upload-financials.ts
 */

import type {
  FlatFileRow,
  FlaggedJob,
  MarginFlagType,
  MarginAnalysisResult,
  MonthSummary,
  TaskOrderSummary,
  TmProfitRow,
} from '@/features/ai-agents/types/margin';

export const LOW_MARGIN_THRESHOLD = 8; // percent - anything below 8% is low margin per client
export const SWING_MULTIPLIER = 1.0; // × std dev - tighter sensitivity per client request
export const DOLLAR_THRESHOLD = 50000; // dollar impact threshold for significant changes

type Baseline = {
  avg: number;
  stdDev: number;
  count: number;
};

function besselStdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function buildBaselines(rows: FlatFileRow[]): Map<string, Baseline> {
  const historicalByJob = new Map<string, number[]>();

  for (const row of rows) {
    if (row.month <= row.latestActual) {
      const existing = historicalByJob.get(row.jobKey) ?? [];
      existing.push(row.marginPct);
      historicalByJob.set(row.jobKey, existing);
    }
  }

  const baselines = new Map<string, Baseline>();
  for (const [jobKey, values] of historicalByJob) {
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = besselStdDev(values);
    baselines.set(jobKey, { avg, stdDev, count: values.length });
  }

  return baselines;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

const MONTH_ORDER: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function compareMonthStrings(a: string, b: string): number {
  const [aMonth, aYear] = a.split(' ');
  const [bMonth, bYear] = b.split(' ');
  const yearDiff = parseInt(aYear, 10) - parseInt(bYear, 10);
  if (yearDiff !== 0) {
    return yearDiff;
  }
  return (MONTH_ORDER[aMonth] ?? 0) - (MONTH_ORDER[bMonth] ?? 0);
}

export function flagFutureRows(
  rows: FlatFileRow[],
  baselines: Map<string, Baseline>,
  asOf: Date = new Date(),
): FlaggedJob[] {
  const startOfCurrentMonth = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const futureRows = rows.filter(
    (r) => r.month > r.latestActual && r.month >= startOfCurrentMonth,
  );

  const flaggedJobs: FlaggedJob[] = [];

  for (const row of futureRows) {
    const flags: MarginFlagType[] = [];
    const baseline = baselines.get(row.jobKey);

    if (row.revenue === 0 && row.profit < 0) {
      flags.push('ZERO_REVENUE');
    }

    if (row.profit < 0) {
      flags.push('NEGATIVE_MARGIN');
    } else if (row.revenue !== 0 && row.marginPct < LOW_MARGIN_THRESHOLD) {
      // Only flag LOW_MARGIN when there is revenue — a 0% margin on $0 revenue
      // is already captured by ZERO_REVENUE and is not an independent concern
      flags.push('LOW_MARGIN');
    }

    if (baseline && baseline.count >= 2) {
      const threshold = SWING_MULTIPLIER * baseline.stdDev;
      const marginDelta = row.marginPct - baseline.avg;
      const isDrop = marginDelta < -threshold;
      const isSwing = Math.abs(marginDelta) > threshold;

      // Flag if either: (1) meets % threshold, or (2) meets dollar threshold
      const meetsThreshold = Math.abs(row.profit) >= DOLLAR_THRESHOLD;

      if (isDrop && meetsThreshold) {
        flags.push('SIGNIFICANT_DROP');
      } else if (isSwing && meetsThreshold) {
        flags.push('SIGNIFICANT_SWING');
      }
    }

    if (flags.length === 0) {
      continue;
    }

    flaggedJobs.push({
      taskOrder: row.taskOrder,
      clin: row.clin,
      taskTitle: row.taskTitle,
      type: row.type,
      month: formatMonth(row.month),
      revenue: row.revenue,
      plannedMarginPct: row.marginPct,
      historicalAvgMarginPct: baseline ? baseline.avg : null,
      historicalStdDev: baseline ? baseline.stdDev : null,
      dollarImpact: row.profit,
      flags,
      revenueCell: `AI${row.csvRowNumber}`,
      profitCell: `AK${row.csvRowNumber}`,
    });
  }

  // Sort by absolute dollar impact descending (worst impact first)
  flaggedJobs.sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact));

  return flaggedJobs;
}

export function buildTmRanking(rows: FlatFileRow[], asOf: Date = new Date()): TmProfitRow[] {
  // Include T&M and Fixed Price (FFP) contracts per client focus
  const startOfCurrentMonth = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const futureRows = rows.filter(
    (r) =>
      (r.type === 'T&M' || r.type === 'FFP') &&
      r.month > r.latestActual &&
      r.month >= startOfCurrentMonth,
  );

  const tmRows: TmProfitRow[] = futureRows.map((r) => ({
    taskOrder: r.taskOrder,
    clin: r.clin,
    taskTitle: r.taskTitle,
    type: r.type,
    month: formatMonth(r.month),
    profit: r.profit,
    revenue: r.revenue,
    marginPct: r.marginPct,
  }));

  // Sort by profit ascending (worst first)
  tmRows.sort((a, b) => a.profit - b.profit);

  return tmRows;
}

type MonthAccumulator = {
  totalRevenue: number;
  totalDollarImpact: number;
  lowestMarginPct: number;
  flaggedClins: number;
  flagTypes: MarginFlagType[];
};

export function buildTaskOrderSummaries(
  flaggedJobs: FlaggedJob[],
  allFutureRows: FlatFileRow[],
): TaskOrderSummary[] {
  // Step 1: Aggregate full-contract stats from ALL future rows (not just flagged ones).
  // This gives us the true forward-looking revenue/profit picture for each task order.
  type FullStats = {
    totalRevenue: number;
    totalDollarImpact: number;
    futureMonths: Set<string>;
    lastMonth: Date;
  };
  const fullStatsMap = new Map<string, FullStats>();
  for (const row of allFutureRows) {
    const monthKey = `${row.month.getUTCFullYear()}-${row.month.getUTCMonth()}`;
    const s = fullStatsMap.get(row.taskOrder);
    if (s) {
      s.totalRevenue += row.revenue;
      s.totalDollarImpact += row.profit;
      s.futureMonths.add(monthKey);
      if (row.month > s.lastMonth) {
        s.lastMonth = row.month;
      }
    } else {
      fullStatsMap.set(row.taskOrder, {
        totalRevenue: row.revenue,
        totalDollarImpact: row.profit,
        futureMonths: new Set([monthKey]),
        lastMonth: row.month,
      });
    }
  }

  // Step 2: Build per-task-order and per-month flagged data from flaggedJobs.
  const summaryMap = new Map<string, TaskOrderSummary>();
  const monthAccMap = new Map<string, Map<string, MonthAccumulator>>();

  for (const job of flaggedJobs) {
    const existing = summaryMap.get(job.taskOrder);
    const fullStats = fullStatsMap.get(job.taskOrder);

    if (existing) {
      existing.flaggedClins++;
      existing.lowestMarginPct = Math.min(existing.lowestMarginPct, job.plannedMarginPct);

      for (const flag of job.flags) {
        if (!existing.flagTypes.includes(flag)) {
          existing.flagTypes.push(flag);
        }
      }
    } else {
      summaryMap.set(job.taskOrder, {
        taskOrder: job.taskOrder,
        taskTitle: job.taskTitle,
        totalClins: 0,
        flaggedClins: 1,
        // Use full-contract totals; fall back to this job's values if missing
        totalRevenue: fullStats?.totalRevenue ?? job.revenue,
        totalDollarImpact: fullStats?.totalDollarImpact ?? job.dollarImpact,
        totalFutureMonths: fullStats?.futureMonths.size ?? 1,
        lastPlannedMonth: fullStats ? formatMonth(fullStats.lastMonth) : job.month,
        avgMarginPct: job.plannedMarginPct,
        lowestMarginPct: job.plannedMarginPct,
        flagTypes: [...job.flags],
        months: [],
      });
    }

    // Build month accumulator for the flagged-months drill-down
    let taskMonthMap = monthAccMap.get(job.taskOrder);
    if (!taskMonthMap) {
      taskMonthMap = new Map();
      monthAccMap.set(job.taskOrder, taskMonthMap);
    }
    const monthAcc = taskMonthMap.get(job.month);
    if (monthAcc) {
      monthAcc.totalRevenue += job.revenue;
      monthAcc.totalDollarImpact += job.dollarImpact;
      monthAcc.lowestMarginPct = Math.min(monthAcc.lowestMarginPct, job.plannedMarginPct);
      monthAcc.flaggedClins++;
      for (const flag of job.flags) {
        if (!monthAcc.flagTypes.includes(flag)) {
          monthAcc.flagTypes.push(flag);
        }
      }
    } else {
      taskMonthMap.set(job.month, {
        totalRevenue: job.revenue,
        totalDollarImpact: job.dollarImpact,
        lowestMarginPct: job.plannedMarginPct,
        flaggedClins: 1,
        flagTypes: [...job.flags],
      });
    }
  }

  // Step 3: Attach sorted flagged-months arrays to each summary
  for (const [taskOrder, summary] of summaryMap) {
    const taskMonthMap = monthAccMap.get(taskOrder);
    if (taskMonthMap) {
      const months: MonthSummary[] = [...taskMonthMap.entries()]
        .map(([month, acc]) => ({ month, ...acc }))
        .sort((a, b) => compareMonthStrings(a.month, b.month));
      summary.months = months;
    }
  }

  // Sort by total dollar impact ascending (worst net loss first)
  const summaries = [...summaryMap.values()];
  summaries.sort((a, b) => a.totalDollarImpact - b.totalDollarImpact);

  return summaries;
}

export function runAnalysis(rows: FlatFileRow[], asOf: Date = new Date()): MarginAnalysisResult {
  const startOfCurrentMonth = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const allFutureRows = rows.filter(
    (r) => r.month > r.latestActual && r.month >= startOfCurrentMonth,
  );

  const baselines = buildBaselines(rows);
  const flaggedJobs = flagFutureRows(rows, baselines, asOf);
  const taskOrderSummaries = buildTaskOrderSummaries(flaggedJobs, allFutureRows);
  const tmProfitRanking = buildTmRanking(rows, asOf);

  const uniqueFutureJobs = new Set(allFutureRows.map((r) => r.jobKey));

  const uniqueFlaggedJobs = new Set(
    flaggedJobs.map((j) => `${j.taskOrder}__${j.clin}`),
  );

  const analysisAsOf = new Date().toISOString();

  return {
    flaggedJobs,
    taskOrderSummaries,
    tmProfitRanking,
    analysisAsOf,
    totalJobsAnalyzed: uniqueFutureJobs.size,
    totalFlaggedJobs: uniqueFlaggedJobs.size,
  };
}
