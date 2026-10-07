/**
 * Route: Export Margin Analysis
 *
 * Generates an Excel workbook with four sheets — Task Order Summary, Flagged Jobs,
 * T&M/FFP Profit Ranking, and Calculation Detail — for a given MARGIN analysis run.
 *
 * Frontend hook: features/ai-agents/api/margin/export-margin-analysis.ts
 */

import { z } from 'zod';
import * as ExcelJS from 'exceljs';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getMarginAnalysis } from '@/features/ai-agents/dal/margin';
import {
  DOLLAR_THRESHOLD,
  LOW_MARGIN_THRESHOLD,
  SWING_MULTIPLIER,
} from '@/features/ai-agents/utils/margin/analyzeMargins';

const FLAG_DISPLAY_LABELS: Record<string, string> = {
  NEGATIVE_MARGIN: 'Losing Money',
  LOW_MARGIN: 'Thin Margin',
  ZERO_REVENUE: 'Not Billed',
  SIGNIFICANT_DROP: 'Margin Dropped',
  SIGNIFICANT_SWING: 'Unusual Swing',
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E0E0' },
};

const input = z.object({
  aiAgentId: z.string().uuid(),
  analysisId: z.string().uuid(),
});

const output = z.object({
  filename: z.string(),
  data: z.string(),
  mimeType: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (a) => a.id === input.aiAgentId && a.type === AiAgentType.MARGIN,
    );

    if (!agent) {
      throw new Error('MARGIN agent not found');
    }

    const record = await getMarginAnalysis(input.aiAgentId, input.analysisId);

    if (!record) {
      throw new Error('Analysis not found');
    }

    const workbook = new ExcelJS.Workbook();
    const asOf = new Date(record.analysisAsOf).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // ── Sheet 1: Task Order Summary ────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Task Order Summary');

    summarySheet.addRow(['File', record.filename]);
    summarySheet.addRow(['Analysis Date', asOf]);
    summarySheet.addRow([]);

    summarySheet.columns = [
      { key: 'taskOrder', width: 16 },
      { key: 'taskTitle', width: 36 },
      { key: 'totalRevenue', width: 18 },
      { key: 'totalProfit', width: 18 },
      { key: 'netMarginPct', width: 16 },
      { key: 'totalFutureMonths', width: 16 },
      { key: 'lastPlannedMonth', width: 18 },
      { key: 'flaggedClins', width: 14 },
      { key: 'flags', width: 50 },
    ];

    const summaryHeader = summarySheet.addRow([
      'Task Order',
      'Task Title',
      'Revenue (all planned months)',
      'Profit (all planned months)',
      'Net Margin %',
      'Total Planned Months',
      'Last Planned Month',
      'Flagged CLINs',
      'Flags',
    ]);
    summaryHeader.font = { bold: true };
    summaryHeader.fill = HEADER_FILL;

    for (const summary of record.taskOrderSummaries) {
      const totalRevenue = summary.totalRevenue ?? 0;
      const netMarginPct = totalRevenue > 0 ? summary.totalDollarImpact / totalRevenue : 0;
      const flagLabels = summary.flagTypes.map((f) => FLAG_DISPLAY_LABELS[f] ?? f).join(', ');

      summarySheet.addRow([
        summary.taskOrder,
        summary.taskTitle,
        totalRevenue,
        summary.totalDollarImpact,
        netMarginPct,
        summary.totalFutureMonths ?? '',
        summary.lastPlannedMonth ?? '',
        summary.flaggedClins,
        flagLabels,
      ]);

    }

    summarySheet.getColumn('totalRevenue').numFmt = '"$"#,##0';
    summarySheet.getColumn('totalProfit').numFmt = '"$"#,##0';
    summarySheet.getColumn('netMarginPct').numFmt = '0.0%';

    // ── Sheet 2: Flagged Jobs ──────────────────────────────────────────────
    const flaggedSheet = workbook.addWorksheet('Flagged Jobs (CLIN Detail)');

    // Metadata rows
    flaggedSheet.addRow(['File', record.filename]);
    flaggedSheet.addRow(['Analysis Date', asOf]);
    flaggedSheet.addRow([]);

    flaggedSheet.columns = [
      { key: 'taskOrder', width: 16 },
      { key: 'clin', width: 8 },
      { key: 'taskTitle', width: 36 },
      { key: 'type', width: 10 },
      { key: 'month', width: 12 },
      { key: 'revenue', width: 16 },
      { key: 'revenueCell', width: 14 },
      { key: 'dollarImpact', width: 16 },
      { key: 'profitCell', width: 14 },
      { key: 'plannedMarginPct', width: 18 },
      { key: 'historicalAvgMarginPct', width: 16 },
      { key: 'flags', width: 50 },
    ];

    const flaggedHeader = flaggedSheet.addRow([
      'Task Order',
      'CLIN',
      'Task Title',
      'Type',
      'Month',
      'Revenue',
      'Revenue Cell',
      'Profit',
      'Profit Cell',
      'Planned Margin %',
      'Hist. Avg %',
      'Flags',
    ]);
    flaggedHeader.font = { bold: true };
    flaggedHeader.fill = HEADER_FILL;

    for (const job of record.flaggedJobs) {
      const flagLabels = job.flags.map((f) => FLAG_DISPLAY_LABELS[f] ?? f).join(', ');
      flaggedSheet.addRow([
        job.taskOrder,
        job.clin,
        job.taskTitle,
        job.type,
        job.month,
        job.revenue,
        job.revenueCell ?? '',
        job.dollarImpact,
        job.profitCell ?? '',
        job.plannedMarginPct / 100,
        job.historicalAvgMarginPct !== null ? job.historicalAvgMarginPct / 100 : '',
        flagLabels,
      ]);

    }

    flaggedSheet.getColumn('revenue').numFmt = '"$"#,##0';
    flaggedSheet.getColumn('dollarImpact').numFmt = '"$"#,##0';
    flaggedSheet.getColumn('plannedMarginPct').numFmt = '0.0%';
    flaggedSheet.getColumn('historicalAvgMarginPct').numFmt = '0.0%';

    // ── Sheet 3: T&M / FFP Profit Ranking ──────────────────────────────────
    const tmSheet = workbook.addWorksheet('T&M FFP Profit Ranking');

    tmSheet.addRow(['File', record.filename]);
    tmSheet.addRow(['Analysis Date', asOf]);
    tmSheet.addRow([]);

    tmSheet.columns = [
      { key: 'taskOrder', width: 16 },
      { key: 'clin', width: 8 },
      { key: 'taskTitle', width: 36 },
      { key: 'month', width: 12 },
      { key: 'revenue', width: 16 },
      { key: 'profit', width: 16 },
      { key: 'marginPct', width: 12 },
    ];

    const tmHeader = tmSheet.addRow([
      'Task Order',
      'CLIN',
      'Task Title',
      'Month',
      'Revenue',
      'Profit',
      'Margin %',
    ]);
    tmHeader.font = { bold: true };
    tmHeader.fill = HEADER_FILL;

    for (const row of record.tmProfitRanking) {
      tmSheet.addRow([
        row.taskOrder,
        row.clin,
        row.taskTitle,
        row.month,
        row.revenue,
        row.profit,
        row.marginPct / 100,
      ]);

    }

    tmSheet.getColumn('revenue').numFmt = '"$"#,##0';
    tmSheet.getColumn('profit').numFmt = '"$"#,##0';
    tmSheet.getColumn('marginPct').numFmt = '0.0%';

    // ── Sheet 4: Calculation Detail ────────────────────────────────────────
    const auditSheet = workbook.addWorksheet('Calculation Detail');

    auditSheet.columns = [
      { key: 'taskOrder', width: 16 },
      { key: 'clin', width: 8 },
      { key: 'taskTitle', width: 36 },
      { key: 'type', width: 10 },
      { key: 'month', width: 12 },
      { key: 'plannedMarginPct', width: 18 },
      { key: 'historicalAvgMarginPct', width: 18 },
      { key: 'delta', width: 18 },
      { key: 'dollarImpact', width: 16 },
      { key: 'flags', width: 36 },
      { key: 'whyFlagged', width: 70 },
    ];

    auditSheet.addRow(['File', record.filename]);
    auditSheet.addRow(['Analysis Date', asOf]);
    auditSheet.addRow(['Thresholds', `LOW_MARGIN < ${LOW_MARGIN_THRESHOLD}%   |   SIGNIFICANT flags: ±${SWING_MULTIPLIER} × std dev from historical avg + dollar threshold ($${(DOLLAR_THRESHOLD / 1000).toFixed(0)}k)`]);
    auditSheet.addRow(['Note', 'Planned Margin % = Profit ÷ Revenue × 100   |   Delta = Planned − Historical Avg']);
    auditSheet.addRow([]);

    const auditHeader = auditSheet.addRow([
      'Task Order',
      'CLIN',
      'Task Title',
      'Type',
      'Month',
      'Planned Margin %',
      'Historical Avg %',
      'Delta',
      'Dollar Impact',
      'Flags',
      'Why Flagged',
    ]);
    auditHeader.font = { bold: true };
    auditHeader.fill = HEADER_FILL;

    for (const job of record.flaggedJobs) {
      const delta = job.historicalAvgMarginPct !== null
        ? job.plannedMarginPct - job.historicalAvgMarginPct
        : null;

      const whyParts: string[] = [];
      for (const flag of job.flags) {
        if (flag === 'NEGATIVE_MARGIN') {
          whyParts.push(`Losing Money: profit ${job.dollarImpact < 0 ? '-' : ''}$${Math.abs(job.dollarImpact).toFixed(0)} < $0`);
        } else if (flag === 'LOW_MARGIN') {
          whyParts.push(`Thin Margin: ${job.plannedMarginPct.toFixed(2)}% is between 0% and ${LOW_MARGIN_THRESHOLD}%`);
        } else if (flag === 'ZERO_REVENUE') {
          whyParts.push('Not Billed: revenue = $0 with negative profit — costs charged with no billing');
        } else if (flag === 'SIGNIFICANT_DROP') {
          whyParts.push(
            job.historicalAvgMarginPct !== null
              ? `Margin Dropped: ${job.plannedMarginPct.toFixed(2)}% is more than ${SWING_MULTIPLIER} std dev below historical avg of ${job.historicalAvgMarginPct.toFixed(2)}% AND dollar impact meets $${(DOLLAR_THRESHOLD / 1000).toFixed(0)}k threshold`
              : 'Margin Dropped: margin well below historical average',
          );
        } else if (flag === 'SIGNIFICANT_SWING') {
          whyParts.push(
            job.historicalAvgMarginPct !== null
              ? `Unusual Swing: ${job.plannedMarginPct.toFixed(2)}% deviates more than ${SWING_MULTIPLIER} std dev from historical avg of ${job.historicalAvgMarginPct.toFixed(2)}% AND dollar impact meets $${(DOLLAR_THRESHOLD / 1000).toFixed(0)}k threshold`
              : 'Unusual Swing: margin unusually far from historical average',
          );
        }
      }

      auditSheet.addRow([
        job.taskOrder,
        job.clin,
        job.taskTitle,
        job.type,
        job.month,
        job.plannedMarginPct / 100,
        job.historicalAvgMarginPct !== null ? job.historicalAvgMarginPct / 100 : '',
        delta !== null ? delta / 100 : '',
        job.dollarImpact,
        job.flags.map((f) => FLAG_DISPLAY_LABELS[f] ?? f).join(', '),
        whyParts.join('   |   '),
      ]);

    }

    auditSheet.getColumn('plannedMarginPct').numFmt = '0.00%';
    auditSheet.getColumn('historicalAvgMarginPct').numFmt = '0.00%';
    auditSheet.getColumn('delta').numFmt = '0.00%';
    auditSheet.getColumn('dollarImpact').numFmt = '"$"#,##0';

    // ── Write buffer ───────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const originalName = record.filename.replace(/\.[^/.]+$/, '');
    const filename = `${originalName}_margin_analysis.xlsx`;

    return {
      filename,
      data: base64,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });
