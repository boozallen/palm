import {
  buildBaselines,
  flagFutureRows,
  buildTmRanking,
  runAnalysis,
} from './analyzeMargins';
import type { FlatFileRow } from '@/features/ai-agents/types/margin';

const LATEST_ACTUAL = new Date('2025-01-01');
const FUTURE_MONTH = new Date('2025-03-01');
const HISTORICAL_MONTH = new Date('2024-11-01');
// asOf is set to mid-Feb 2025 so FUTURE_MONTH (Mar 2025) is treated as current-or-forward
const AS_OF = new Date('2025-02-15');

function makeRow(overrides: Partial<FlatFileRow> = {}): FlatFileRow {
  const revenue = overrides.revenue ?? 100000;
  const profit = overrides.profit ?? 10000;
  const marginPct = revenue !== 0 ? (profit / revenue) * 100 : 0;
  return {
    jobKey: 'JOB001__0001',
    taskOrder: 'JOB001',
    clin: '0001',
    taskTitle: 'Task One',
    type: 'FFP',
    latestActual: LATEST_ACTUAL,
    month: FUTURE_MONTH,
    revenue,
    profit,
    aorP: 'Planned',
    marginPct,
    csvRowNumber: 2,
    ...overrides,
  };
}

// ── buildBaselines ──────────────────────────────────────────────────────────

describe('buildBaselines', () => {
  it('only uses rows where month <= latestActual', () => {
    const rows = [
      makeRow({ month: HISTORICAL_MONTH, profit: 10000, revenue: 100000, marginPct: 10 }),
      makeRow({ month: FUTURE_MONTH, profit: 5000, revenue: 100000, marginPct: 5 }),
    ];
    const baselines = buildBaselines(rows);
    const baseline = baselines.get('JOB001__0001');
    expect(baseline).toBeDefined();
    expect(baseline!.count).toBe(1);
    expect(baseline!.avg).toBeCloseTo(10, 5);
  });

  it('computes average correctly across multiple historical rows', () => {
    const rows = [
      makeRow({ month: HISTORICAL_MONTH, marginPct: 10 }),
      makeRow({ month: new Date('2024-10-01'), marginPct: 20 }),
    ];
    const baselines = buildBaselines(rows);
    expect(baselines.get('JOB001__0001')!.avg).toBeCloseTo(15, 5);
  });

  it('computes Bessel-corrected std dev', () => {
    // Values: 10, 20 → mean = 15, variance = ((10-15)²+(20-15)²) / 1 = 50, stdDev = √50 ≈ 7.071
    const rows = [
      makeRow({ month: HISTORICAL_MONTH, marginPct: 10 }),
      makeRow({ month: new Date('2024-10-01'), marginPct: 20 }),
    ];
    const baselines = buildBaselines(rows);
    expect(baselines.get('JOB001__0001')!.stdDev).toBeCloseTo(7.071, 2);
  });

  it('returns stdDev of 0 when only one historical row', () => {
    const rows = [makeRow({ month: HISTORICAL_MONTH, marginPct: 10 })];
    const baselines = buildBaselines(rows);
    expect(baselines.get('JOB001__0001')!.stdDev).toBe(0);
  });

  it('groups baselines separately per job', () => {
    const rows = [
      makeRow({ jobKey: 'JOB001__0001', month: HISTORICAL_MONTH, marginPct: 10 }),
      makeRow({ jobKey: 'JOB002__0002', taskOrder: 'JOB002', clin: '0002', month: HISTORICAL_MONTH, marginPct: 20 }),
    ];
    const baselines = buildBaselines(rows);
    expect(baselines.size).toBe(2);
    expect(baselines.get('JOB001__0001')!.avg).toBeCloseTo(10, 5);
    expect(baselines.get('JOB002__0002')!.avg).toBeCloseTo(20, 5);
  });
});

// ── flagFutureRows ──────────────────────────────────────────────────────────

describe('flagFutureRows', () => {
  it('flags NEGATIVE_MARGIN when profit < 0', () => {
    const rows = [makeRow({ profit: -5000, revenue: 100000, marginPct: -5 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(1);
    expect(result[0].flags).toContain('NEGATIVE_MARGIN');
  });

  it('flags LOW_MARGIN when 0 <= marginPct < 8', () => {
    const rows = [makeRow({ profit: 5000, revenue: 100000, marginPct: 5 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(1);
    expect(result[0].flags).toContain('LOW_MARGIN');
    expect(result[0].flags).not.toContain('NEGATIVE_MARGIN');
  });

  it('does not flag LOW_MARGIN when marginPct >= 8', () => {
    const rows = [makeRow({ profit: 10000, revenue: 100000, marginPct: 10 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(0);
  });

  it('flags ZERO_REVENUE when revenue = 0 and profit is negative', () => {
    const rows = [makeRow({ revenue: 0, profit: -5000, marginPct: 0 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(1);
    expect(result[0].flags).toContain('ZERO_REVENUE');
    expect(result[0].flags).toContain('NEGATIVE_MARGIN');
  });

  it('does not flag when revenue = 0 and profit = 0', () => {
    const rows = [makeRow({ revenue: 0, profit: 0, marginPct: 0 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(0);
  });

  it('excludes future rows with no flags', () => {
    const rows = [makeRow({ profit: 15000, revenue: 100000, marginPct: 15 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(0);
  });

  it('excludes historical rows even if they would breach thresholds', () => {
    const rows = [makeRow({ month: HISTORICAL_MONTH, profit: -5000, revenue: 100000, marginPct: -5 })];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result).toHaveLength(0);
  });

  it('flags SIGNIFICANT_DROP when marginPct < avg - 1.0 * stdDev and meets dollar threshold', () => {
    // avg=15, stdDev=7.071, threshold=15 - 1.0*7.071 = 7.93 → marginPct=5 triggers drop
    // profit must be >= $50k to meet dollar threshold
    const baselines = new Map([
      ['JOB001__0001', { avg: 15, stdDev: 7.071, count: 2 }],
    ]);
    const rows = [makeRow({ marginPct: 5, profit: 50000, revenue: 1000000 })];
    const result = flagFutureRows(rows, baselines, AS_OF);
    expect(result[0].flags).toContain('SIGNIFICANT_DROP');
  });

  it('flags SIGNIFICANT_SWING when |marginPct - avg| > 1.0 * stdDev (upward) and meets dollar threshold', () => {
    // avg=15, stdDev=7.071, threshold=7.071 → marginPct=25: |25-15|=10 > 7.071 → swing
    // profit must be >= $50k to meet dollar threshold
    const baselines = new Map([
      ['JOB001__0001', { avg: 15, stdDev: 7.071, count: 2 }],
    ]);
    const rows = [makeRow({ marginPct: 25, profit: 250000, revenue: 1000000 })];
    const result = flagFutureRows(rows, baselines, AS_OF);
    expect(result[0].flags).toContain('SIGNIFICANT_SWING');
    expect(result[0].flags).not.toContain('SIGNIFICANT_DROP');
  });

  it('does not flag SIGNIFICANT_DROP/SWING when baseline count < 2', () => {
    const baselines = new Map([
      ['JOB001__0001', { avg: 15, stdDev: 0, count: 1 }],
    ]);
    const rows = [makeRow({ marginPct: -20, profit: -20000, revenue: 100000 })];
    const result = flagFutureRows(rows, baselines, AS_OF);
    expect(result[0].flags).not.toContain('SIGNIFICANT_DROP');
    expect(result[0].flags).not.toContain('SIGNIFICANT_SWING');
  });

  it('does not flag SIGNIFICANT_DROP/SWING when dollar threshold not met', () => {
    const baselines = new Map([
      ['JOB001__0001', { avg: 15, stdDev: 7.071, count: 2 }],
    ]);
    // Large % swing but small dollar amount (below $50k threshold)
    const rows = [makeRow({ marginPct: 5, profit: 5000, revenue: 100000 })];
    const result = flagFutureRows(rows, baselines, AS_OF);
    expect(result[0].flags).not.toContain('SIGNIFICANT_DROP');
    expect(result[0].flags).not.toContain('SIGNIFICANT_SWING');
  });

  it('sorts by absolute dollar impact descending', () => {
    const rows = [
      makeRow({ jobKey: 'JOB001__0001', profit: -1000, revenue: 100000, marginPct: -1 }),
      makeRow({ jobKey: 'JOB002__0002', taskOrder: 'JOB002', clin: '0002', profit: -50000, revenue: 100000, marginPct: -50 }),
      makeRow({ jobKey: 'JOB003__0003', taskOrder: 'JOB003', clin: '0003', profit: -10000, revenue: 100000, marginPct: -10 }),
    ];
    const result = flagFutureRows(rows, new Map(), AS_OF);
    expect(result[0].dollarImpact).toBe(-50000);
    expect(result[1].dollarImpact).toBe(-10000);
    expect(result[2].dollarImpact).toBe(-1000);
  });

  it('sets historicalAvgMarginPct from baseline, null when no baseline', () => {
    const baselines = new Map([
      ['JOB001__0001', { avg: 12.5, stdDev: 3, count: 2 }],
    ]);
    const rows = [makeRow({ profit: -1000, revenue: 100000, marginPct: -1 })];
    const result = flagFutureRows(rows, baselines, AS_OF);
    expect(result[0].historicalAvgMarginPct).toBeCloseTo(12.5, 5);

    const resultNoBaseline = flagFutureRows(rows, new Map(), AS_OF);
    expect(resultNoBaseline[0].historicalAvgMarginPct).toBeNull();
  });
});

// ── buildTmRanking ──────────────────────────────────────────────────────────

describe('buildTmRanking', () => {
  it('includes both T&M and FFP rows', () => {
    const rows = [
      makeRow({ type: 'T&M', profit: 5000 }),
      makeRow({ jobKey: 'JOB002__0002', taskOrder: 'JOB002', clin: '0002', type: 'FFP', profit: 2000 }),
      makeRow({ jobKey: 'JOB003__0003', taskOrder: 'JOB003', clin: '0003', type: 'CPF', profit: 3000 }),
    ];
    const result = buildTmRanking(rows, AS_OF);
    expect(result).toHaveLength(2);
    expect(result.some((r) => r.taskOrder === 'JOB001')).toBe(true);
    expect(result.some((r) => r.taskOrder === 'JOB002')).toBe(true);
  });

  it('only includes future rows', () => {
    const rows = [
      makeRow({ type: 'T&M', month: HISTORICAL_MONTH, profit: 5000 }),
      makeRow({ type: 'T&M', month: FUTURE_MONTH, profit: 3000 }),
    ];
    const result = buildTmRanking(rows, AS_OF);
    expect(result).toHaveLength(1);
  });

  it('sorts by profit ascending (worst first)', () => {
    const rows = [
      makeRow({ type: 'T&M', profit: 5000, marginPct: 5 }),
      makeRow({ jobKey: 'JOB002__0002', type: 'FFP', profit: -10000, marginPct: -10 }),
      makeRow({ jobKey: 'JOB003__0003', type: 'T&M', profit: 1000, marginPct: 1 }),
    ];
    const result = buildTmRanking(rows, AS_OF);
    expect(result[0].profit).toBe(-10000);
    expect(result[1].profit).toBe(1000);
    expect(result[2].profit).toBe(5000);
  });

  it('returns empty array when no T&M or FFP future rows', () => {
    const rows = [makeRow({ type: 'CPF' })];
    expect(buildTmRanking(rows, AS_OF)).toHaveLength(0);
  });
});

// ── runAnalysis ─────────────────────────────────────────────────────────────

describe('runAnalysis', () => {
  it('returns correct totalJobsAnalyzed and totalFlaggedJobs', () => {
    const rows = [
      // Job 1 — historical
      makeRow({ jobKey: 'JOB001__0001', month: HISTORICAL_MONTH, marginPct: 10 }),
      // Job 1 — future, flagged (negative)
      makeRow({ jobKey: 'JOB001__0001', profit: -5000, revenue: 100000, marginPct: -5 }),
      // Job 2 — future, not flagged
      makeRow({ jobKey: 'JOB002__0002', taskOrder: 'JOB002', clin: '0002', profit: 15000, revenue: 100000, marginPct: 15 }),
    ];
    const result = runAnalysis(rows, AS_OF);
    expect(result.totalJobsAnalyzed).toBe(2); // 2 unique jobs with future rows
    expect(result.totalFlaggedJobs).toBe(1);  // only JOB001 is flagged
  });

  it('returns analysisAsOf as an ISO string', () => {
    const result = runAnalysis([makeRow({ profit: -1000, marginPct: -1 })], AS_OF);
    expect(() => new Date(result.analysisAsOf)).not.toThrow();
    expect(new Date(result.analysisAsOf).getTime()).not.toBeNaN();
  });

  it('returns empty arrays when no future rows qualify', () => {
    const rows = [makeRow({ month: HISTORICAL_MONTH })];
    const result = runAnalysis(rows, AS_OF);
    expect(result.flaggedJobs).toHaveLength(0);
    expect(result.tmProfitRanking).toHaveLength(0);
  });
});
